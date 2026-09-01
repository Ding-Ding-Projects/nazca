'use client';

import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';
import { useVisitorState } from '@/components/visitor-state-provider';
import { changelogEntries, releaseCodeName } from '@/data/changelog';
import { loadPrivateValue, savePrivateValue } from '@/lib/visitor-state';
import {
  generateTotp,
  loadTotpEntries,
  parseOtpAuthUri,
  saveTotpEntries,
  toOtpAuthUri,
  type TotpEntry,
} from '@/lib/totp';

type ToolTab =
  | 'authenticator'
  | 'converter'
  | 'models'
  | 'history'
  | 'notifications'
  | 'exports'
  | 'changelog'
  | 'support'
  | 'help';

const toolTabs: Array<{ id: ToolTab; title: string; description: string }> = [
  {
    id: 'authenticator',
    title: 'Authenticator',
    description: 'Local TOTP codes, QR pairing, and redacted export.',
  },
  {
    id: 'converter',
    title: 'File converter',
    description: 'Bounded local text, data, image, and encoding adapters.',
  },
  {
    id: 'models',
    title: 'Local models',
    description: 'Consent-based loopback Ollama status and installed tags.',
  },
  {
    id: 'history',
    title: 'Local history',
    description: 'Append-only redacted visitor events.',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Review, dismiss, clear, and export local notices.',
  },
  {
    id: 'exports',
    title: 'Exports',
    description: 'Download visitor-owned state in faithful formats.',
  },
  {
    id: 'changelog',
    title: 'Changelog',
    description:
      'Every development version with exact commit links and date filters.',
  },
  {
    id: 'support',
    title: 'Support Tickets',
    description:
      'A fictional local support desk with an honest browser-storage recovery path.',
  },
  {
    id: 'help',
    title: 'Offline help',
    description: 'Browser capability boundaries and recovery.',
  },
];

function download(name: string, type: string, content: BlobPart) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ToolsWorkspace({
  initialTab = 'authenticator',
}: {
  initialTab?: ToolTab;
}) {
  const {
    clearNotifications,
    dismissNotification,
    exportVisitorData,
    history,
    notifications,
    notify,
  } = useVisitorState();
  const [activeTab, setActiveTab] = useState<ToolTab>(initialTab);
  useEffect(() => {
    const timer = setTimeout(() => setActiveTab(initialTab), 0);
    return () => clearTimeout(timer);
  }, [initialTab]);
  useEffect(() => {
    const openTool = (event: Event) => {
      const requested = (event as CustomEvent<ToolTab>).detail;
      if (toolTabs.some((tab) => tab.id === requested)) setActiveTab(requested);
    };
    window.addEventListener('nazca:open-tool', openTool);
    return () => window.removeEventListener('nazca:open-tool', openTool);
  }, []);
  const records = useMemo<SearchRecord[]>(
    () =>
      toolTabs.map((tool) => ({
        id: tool.id,
        title: tool.title,
        subtitle: tool.description,
        text: `${tool.title} ${tool.description}`,
      })),
    [],
  );

  return (
    <section className="tools-workspace" aria-labelledby="tools-heading">
      <p className="eyebrow">Local browser tools</p>
      <h1 id="tools-heading" className="workspace-title">
        Useful locally, honest at the boundary.
      </h1>
      <p className="lede">
        These tools run in this browser. They do not claim operating-system
        vault access, arbitrary executable launch, unrestricted folder writes,
        or cloud synchronization.
      </p>
      <SearchWorkbench
        surfaceId="tools-catalog-search"
        label="Search tools"
        placeholder="Find a local tool"
        records={records}
        onActivate={(record) => setActiveTab(record.id as ToolTab)}
      />
      <nav className="tool-tabs" aria-label="Tool tabs">
        {toolTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.title}
          </button>
        ))}
      </nav>
      <div className="tool-panel">
        {activeTab === 'authenticator' ? (
          <AuthenticatorTool notify={notify} />
        ) : null}
        {activeTab === 'converter' ? <ConverterTool notify={notify} /> : null}
        {activeTab === 'models' ? <OllamaTool notify={notify} /> : null}
        {activeTab === 'history' ? <HistoryTool records={history} /> : null}
        {activeTab === 'notifications' ? (
          <NotificationTool
            records={notifications}
            dismiss={dismissNotification}
            clear={clearNotifications}
          />
        ) : null}
        {activeTab === 'exports' ? (
          <ExportTool exportVisitorData={exportVisitorData} />
        ) : null}
        {activeTab === 'changelog' ? <ChangelogTool /> : null}
        {activeTab === 'support' ? <SupportTicketsTool /> : null}
        {activeTab === 'help' ? <OfflineHelp /> : null}
      </div>
    </section>
  );
}

function AuthenticatorTool({
  notify,
}: {
  notify: ReturnType<typeof useVisitorState>['notify'];
}) {
  const [entries, setEntries] = useState<TotpEntry[]>([]);
  const [uri, setUri] = useState('');
  const [issuer, setIssuer] = useState('');
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState('No authenticator entries loaded.');
  const [now, setNow] = useState(0);
  const [codes, setCodes] = useState<
    Record<string, { current: string; next: string }>
  >({});
  const [revealedQr, setRevealedQr] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    loadTotpEntries()
      .then((loaded) => {
        setEntries(loaded);
        setStatus(`${loaded.length} encrypted local entries loaded.`);
      })
      .catch(() =>
        setStatus('Authenticator storage is unavailable or corrupt.'),
      );
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const initial = setTimeout(() => setNow(Date.now()), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, []);

  useEffect(() => {
    Promise.all(
      entries.map(
        async (entry) =>
          [
            entry.id,
            {
              current: await generateTotp(entry, now),
              next: await generateTotp(entry, now + entry.period * 1000),
            },
          ] as const,
      ),
    )
      .then((values) => setCodes(Object.fromEntries(values)))
      .catch(() => undefined);
  }, [entries, now]);

  useEffect(() => {
    const entry = entries.find((candidate) => candidate.id === revealedQr);
    if (!entry) {
      const timer = setTimeout(() => setQrDataUrl(''), 0);
      return () => clearTimeout(timer);
    }
    QRCode.toDataURL(toOtpAuthUri(entry), {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 256,
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setStatus('QR rendering failed locally.'));
  }, [entries, revealedQr]);

  const persist = async (next: TotpEntry[]) => {
    await saveTotpEntries(next);
    setEntries(next);
  };

  const addEntry = async () => {
    try {
      const entry = uri.trim()
        ? parseOtpAuthUri(uri.trim())
        : parseOtpAuthUri(
            `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?${new URLSearchParams(
              {
                secret,
                issuer,
                algorithm: 'SHA1',
                digits: '6',
                period: '30',
              },
            )}`,
          );
      const next = [...entries, entry];
      await persist(next);
      setUri('');
      setSecret('');
      setStatus(
        `Added ${entry.issuer} · ${entry.account}. Secret bytes are encrypted locally.`,
      );
      notify({
        kind: 'success',
        title: 'Authenticator entry added',
        body: `${entry.issuer} · ${entry.account}`,
      });
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'The entry is invalid.',
      );
    }
  };

  const readQrImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024)
        throw new Error('QR image exceeds the 8 MiB limit.');
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 16_000_000)
        throw new Error('QR image exceeds the 16 megapixel limit.');
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Image decoding is unavailable.');
      context.drawImage(bitmap, 0, 0);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(image.data, image.width, image.height);
      if (!decoded?.data.startsWith('otpauth://'))
        throw new Error('No TOTP QR code was found.');
      setUri(decoded.data);
      setStatus('QR read locally. Review the account, then add it.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'QR reading failed.');
    }
  };

  const searchRecords = entries.map((entry) => ({
    id: entry.id,
    title: entry.issuer,
    subtitle: entry.account,
    text: `${entry.issuer} ${entry.account} ${entry.algorithm} ${entry.digits} ${entry.period}`,
  }));

  return (
    <section aria-labelledby="authenticator-title">
      <h2 id="authenticator-title">Local TOTP authenticator</h2>
      <p className="tool-description">
        RFC 6238 codes stay local. Secrets are encrypted in IndexedDB with a
        non-extractable Web Crypto key. Ordinary exports omit them.
      </p>
      <SearchWorkbench
        surfaceId="authenticator-search"
        label="Search authenticator entries"
        placeholder="Find issuer or account"
        records={searchRecords}
        onActivate={(record) =>
          document.getElementById(`totp-${record.id}`)?.focus()
        }
      />
      <div className="tool-form-grid">
        <label>
          otpauth URI
          <input
            value={uri}
            onChange={(event) => setUri(event.target.value)}
            placeholder="otpauth://totp/…"
          />
        </label>
        <label>
          QR image
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => readQrImage(event.target.files?.[0])}
          />
        </label>
        <label>
          Issuer
          <input
            value={issuer}
            onChange={(event) => setIssuer(event.target.value)}
          />
        </label>
        <label>
          Account
          <input
            value={account}
            onChange={(event) => setAccount(event.target.value)}
          />
        </label>
        <label>
          Manual Base32 secret
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
        </label>
        <button type="button" className="primary-action" onClick={addEntry}>
          Add entry
        </button>
      </div>
      <output className="tool-status">{status}</output>
      <div className="totp-grid">
        {entries.map((entry) => {
          const seconds =
            entry.period - (Math.floor(now / 1000) % entry.period);
          return (
            <article
              className="totp-card"
              id={`totp-${entry.id}`}
              tabIndex={-1}
              key={entry.id}
            >
              <h3>{entry.issuer}</h3>
              <p>{entry.account}</p>
              <output aria-label={`Current code for ${entry.issuer}`}>
                {codes[entry.id]?.current ?? '••••••'}
              </output>
              <p>
                {seconds} seconds · next {codes[entry.id]?.next ?? '••••••'}
              </p>
              <div className="tool-actions">
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      codes[entry.id]?.current ?? '',
                    )
                  }
                >
                  Copy code
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRevealedQr(revealedQr === entry.id ? null : entry.id)
                  }
                >
                  {revealedQr === entry.id
                    ? 'Hide pairing QR'
                    : 'Reveal pairing QR'}
                </button>
                <button
                  type="button"
                  onClick={async () =>
                    persist(
                      entries.filter((candidate) => candidate.id !== entry.id),
                    )
                  }
                >
                  Remove
                </button>
              </div>
              {revealedQr === entry.id && qrDataUrl ? (
                <figure className="totp-qr">
                  <object
                    data={qrDataUrl}
                    type="image/png"
                    aria-label={`TOTP pairing QR for ${entry.issuer}, ${entry.account}`}
                  />
                  <figcaption>
                    Scan locally. The manual secret is intentionally not shown
                    again.
                  </figcaption>
                </figure>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ConverterTool({
  notify,
}: {
  notify: ReturnType<typeof useVisitorState>['notify'];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [operation, setOperation] = useState('json-pretty');
  const [status, setStatus] = useState('Choose a local file.');

  const convert = async () => {
    if (!file) return;
    try {
      if (file.size > 32 * 1024 * 1024)
        throw new Error('This browser adapter limits each file to 32 MiB.');
      if (operation === 'json-pretty') {
        const parsed = JSON.parse(await file.text());
        download(
          `${file.name.replace(/\.json$/i, '')}.pretty.json`,
          'application/json',
          `${JSON.stringify(parsed, null, 2)}\n`,
        );
      } else if (operation === 'text-base64') {
        if (file.size > 2 * 1024 * 1024)
          throw new Error('Base64 text conversion is limited to 2 MiB.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        download(
          `${file.name}.base64.txt`,
          'text/plain;charset=utf-8',
          btoa(binary),
        );
      } else if (operation === 'csv-json') {
        const rows = (await file.text())
          .split(/\r\n|\n|\r/)
          .filter(Boolean)
          .map((row) => row.split(','));
        const headers = rows.shift() ?? [];
        const result = rows.map((row) =>
          Object.fromEntries(
            headers.map((header, index) => [header, row[index] ?? '']),
          ),
        );
        download(
          `${file.name.replace(/\.csv$/i, '')}.json`,
          'application/json',
          `${JSON.stringify(result, null, 2)}\n`,
        );
      } else {
        const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        const png =
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47;
        const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
        if (!png && !jpeg)
          throw new Error(
            'The image signature is not a supported PNG or JPEG.',
          );
        const bitmap = await createImageBitmap(file);
        if (bitmap.width * bitmap.height > 32_000_000)
          throw new Error('Image exceeds the 32 megapixel limit.');
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/webp', 0.9),
        );
        if (!blob) throw new Error('Browser image encoding failed.');
        download(
          `${file.name.replace(/\.[^.]+$/, '')}.webp`,
          'image/webp',
          blob,
        );
      }
      setStatus(`Converted ${file.name}. The source was not changed.`);
      notify({
        kind: 'success',
        title: 'Conversion complete',
        body: file.name,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Conversion failed.';
      setStatus(message);
      notify({ kind: 'error', title: 'Conversion failed', body: message });
    }
  };

  return (
    <section aria-labelledby="converter-title">
      <h2 id="converter-title">Local file converter</h2>
      <p className="tool-description">
        Enabled adapters are bundled browser paths. PDF, audio, video, archives,
        and 7z remain visible below with their exact unavailable reason.
      </p>
      <div className="tool-form-grid">
        <label>
          Source file
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          Adapter
          <select
            value={operation}
            onChange={(event) => setOperation(event.target.value)}
          >
            <option value="json-pretty">JSON → formatted JSON</option>
            <option value="csv-json">CSV → JSON, simple unquoted rows</option>
            <option value="text-base64">File → Base64 text</option>
            <option value="image-webp">PNG or JPEG → WebP</option>
          </select>
        </label>
        <button
          className="primary-action"
          type="button"
          disabled={!file}
          onClick={convert}
        >
          Convert locally
        </button>
      </div>
      <output className="tool-status">{status}</output>
      <div className="adapter-grid">
        <article>
          <strong>Documents and PDF</strong>
          <p>Unavailable: no verified bundled PDF adapter yet.</p>
        </article>
        <article>
          <strong>Images</strong>
          <p>
            PNG and JPEG decode to WebP through browser canvas, with signature
            and pixel bounds.
          </p>
        </article>
        <article>
          <strong>Audio and video</strong>
          <p>
            Unavailable: browser codecs do not provide the required faithful
            offline adapter registry.
          </p>
        </article>
        <article>
          <strong>Archives</strong>
          <p>Unavailable: ZIP and 7z adapters are not bundled yet.</p>
        </article>
        <article>
          <strong>Structured data</strong>
          <p>JSON formatting and simple CSV to JSON are enabled.</p>
        </article>
        <article>
          <strong>Code, text, and binary encodings</strong>
          <p>Bounded Base64 output is enabled.</p>
        </article>
      </div>
    </section>
  );
}

function OllamaTool({
  notify,
}: {
  notify: ReturnType<typeof useVisitorState>['notify'];
}) {
  const [status, setStatus] = useState(
    'Not checked. Loopback access requires your explicit action.',
  );
  const [models, setModels] = useState<Array<{ name: string; size?: number }>>(
    [],
  );
  const check = async () => {
    setStatus('Checking http://127.0.0.1:11434 with your consent…');
    try {
      const [versionResponse, tagsResponse] = await Promise.all([
        fetch('http://127.0.0.1:11434/api/version', {
          signal: AbortSignal.timeout(5000),
        }),
        fetch('http://127.0.0.1:11434/api/tags', {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
      if (!versionResponse.ok || !tagsResponse.ok)
        throw new Error(
          `Local API returned HTTP ${versionResponse.status}/${tagsResponse.status}.`,
        );
      const version = (await versionResponse.json()) as { version?: unknown };
      const tags = (await tagsResponse.json()) as { models?: unknown };
      const installed = Array.isArray(tags.models)
        ? tags.models
            .filter(
              (model): model is { name: string; size?: number } =>
                !!model &&
                typeof model === 'object' &&
                'name' in model &&
                typeof model.name === 'string' &&
                (!('size' in model) || typeof model.size === 'number'),
            )
            .slice(0, 5000)
        : [];
      setModels(installed);
      setStatus(
        `Local Ollama ${typeof version.version === 'string' ? version.version : 'version unknown'} is reachable. ${installed.length} installed tags reported.`,
      );
      notify({
        kind: 'success',
        title: 'Local Ollama reachable',
        body: `${installed.length} installed tags`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Loopback request failed.';
      setStatus(
        `Unavailable: ${message} The service may be stopped, absent, or refusing browser CORS.`,
      );
      notify({
        kind: 'warning',
        title: 'Local Ollama unavailable',
        body: message,
      });
    }
  };
  return (
    <section aria-labelledby="models-title">
      <h2 id="models-title">Local Ollama manager</h2>
      <p className="tool-description">
        This browser can use only the documented loopback API when CORS permits
        it. It cannot launch executables, run arbitrary shell commands, or
        substitute a cloud service.
      </p>
      <button type="button" className="primary-action" onClick={check}>
        Check local Ollama
      </button>
      <output className="tool-status">{status}</output>
      <ul className="model-list">
        {models.map((model) => (
          <li key={model.name}>
            <strong>{model.name}</strong>
            <span>
              {model.size
                ? `${(model.size / 1024 ** 3).toFixed(2)} GiB`
                : 'Size unavailable'}{' '}
              · fit verdict Unknown until complete metadata and hardware
              evidence exist
            </span>
          </li>
        ))}
      </ul>
      <div className="adapter-grid">
        <article>
          <strong>Official catalog</strong>
          <p>
            Unavailable until a complete paginated official snapshot is
            verified. No curated substitute is shown.
          </p>
        </article>
        <article>
          <strong>Batch pulls</strong>
          <p>
            Unavailable until durable progress, disk preflight, cancel, retry,
            and partial outcomes are implemented.
          </p>
        </article>
        <article>
          <strong>Chat and attachments</strong>
          <p>
            Unavailable until the selected local model reports compatible
            capabilities.
          </p>
        </article>
        <article>
          <strong>Harness launch</strong>
          <p>
            Unavailable in a static browser because arbitrary local executable
            launch is not a safe browser capability.
          </p>
        </article>
      </div>
    </section>
  );
}

function HistoryTool({
  records,
}: {
  records: ReturnType<typeof useVisitorState>['history'];
}) {
  const searchRecords = records.map((record) => ({
    id: record.id,
    title: record.action,
    subtitle: record.summary,
    text: `${record.action} ${record.target} ${record.timestamp} ${record.summary}`,
  }));
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title">Append-only local history</h2>
      <p className="tool-description">
        Restores will be new events. Secrets and private vocabulary content
        never enter these records.
      </p>
      <SearchWorkbench
        surfaceId="history-search"
        label="Search local history"
        placeholder="Find action, target, or date"
        records={searchRecords}
        onActivate={(record) =>
          document.getElementById(`history-${record.id}`)?.focus()
        }
      />
      <ol className="history-list">
        {records.toReversed().map((record) => (
          <li id={`history-${record.id}`} tabIndex={-1} key={record.id}>
            <strong>
              #{record.sequence} · {record.action}
            </strong>
            <span>
              {record.timestamp} · {record.target}
            </span>
            <p>{record.summary}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NotificationTool({
  records,
  dismiss,
  clear,
}: {
  records: ReturnType<typeof useVisitorState>['notifications'];
  dismiss: (id: string) => void;
  clear: () => void;
}) {
  const searchRecords = records.map((record) => ({
    id: record.id,
    title: record.title,
    subtitle: record.body,
    text: `${record.kind} ${record.title} ${record.body} ${record.createdAt}`,
  }));
  return (
    <section aria-labelledby="notifications-title">
      <div className="tool-heading-row">
        <div>
          <h2 id="notifications-title">Notification center</h2>
          <p className="tool-description">
            Dismissed notices stay reviewable until you clear the local list.
          </p>
        </div>
        <button type="button" onClick={clear}>
          Clear all
        </button>
      </div>
      <SearchWorkbench
        surfaceId="notification-search"
        label="Search notifications"
        placeholder="Find a local notice"
        records={searchRecords}
        onActivate={(record) =>
          document.getElementById(`notification-${record.id}`)?.focus()
        }
      />
      <ul className="notification-list">
        {records.toReversed().map((record) => (
          <li id={`notification-${record.id}`} tabIndex={-1} key={record.id}>
            <strong>{record.title}</strong>
            <span>
              {record.kind} · {record.createdAt}
            </span>
            <p>{record.body}</p>
            <button
              type="button"
              disabled={record.dismissed}
              onClick={() => dismiss(record.id)}
            >
              {record.dismissed ? 'Dismissed' : 'Dismiss'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExportTool({
  exportVisitorData,
}: {
  exportVisitorData: () => string;
}) {
  const exportJson = () =>
    download(
      'nazca-visitor-state.json',
      'application/json',
      exportVisitorData(),
    );
  const exportMarkdown = () => {
    const parsed = JSON.parse(exportVisitorData());
    download(
      'nazca-visitor-state.md',
      'text/markdown;charset=utf-8',
      `# Nazca Railway visitor export\n\nExported: ${parsed.exportedAt}\n\nSecrets omitted: ${parsed.omitted.join(', ')}.\n\n\`\`\`json\n${JSON.stringify(parsed.state, null, 2)}\n\`\`\`\n`,
    );
  };
  return (
    <section aria-labelledby="exports-title">
      <h2 id="exports-title">Exports</h2>
      <p className="tool-description">
        The enabled formats preserve current visitor settings and redacted local
        records. Personal vocabulary, credentials, and authenticator secrets are
        omitted and named as omitted.
      </p>
      <div className="tool-actions">
        <button type="button" onClick={exportJson}>
          Export JSON
        </button>
        <button type="button" onClick={exportMarkdown}>
          Export Markdown
        </button>
      </div>
      <div className="adapter-grid">
        <article>
          <strong>CSV, TSV, JSONL, YAML, TOML, XML, HTML, and SQL</strong>
          <p>
            Visible but unavailable until each serializer can preserve this
            nested state without dropping fields.
          </p>
        </article>
        <article>
          <strong>ZIP and 7z</strong>
          <p>
            Unavailable until bundled archive adapters provide the full
            documented options.
          </p>
        </article>
        <article>
          <strong>Open in Visual Studio Code</strong>
          <p>
            Unavailable from this static browser. The download remains fully
            usable without an editor integration.
          </p>
        </article>
      </div>
    </section>
  );
}

function OfflineHelp() {
  return (
    <section aria-labelledby="help-title">
      <h2 id="help-title">Offline browser boundaries</h2>
      <div className="adapter-grid">
        <article>
          <strong>Storage</strong>
          <p>
            IndexedDB replaces an operating-system vault and local Git. Clear
            this origin’s storage to reset local credentials.
          </p>
        </article>
        <article>
          <strong>Files</strong>
          <p>
            File inputs and downloads replace unrestricted folder access.
            Sources are never overwritten.
          </p>
        </article>
        <article>
          <strong>Local services</strong>
          <p>
            Ollama works only through explicit loopback requests when browser
            CORS permits them.
          </p>
        </article>
        <article>
          <strong>Offline bundle</strong>
          <p>
            The static ZIP runs through a loopback-only Node server. It is not a
            native installer.
          </p>
        </article>
      </div>
    </section>
  );
}

function ChangelogTool() {
  const [startDate, setStartDate] = useState('2026-08-31');
  const [endDate, setEndDate] = useState('2026-12-31');
  const filteredByDate = changelogEntries.filter((entry) => {
    const date = entry.date.slice(0, 10);
    return date >= startDate && date <= endDate;
  });
  const searchRecords = filteredByDate.map((entry) => ({
    id: entry.commit,
    title: `${entry.version} · ${entry.title}`,
    subtitle: `${entry.category} · ${entry.date}`,
    text: `${entry.version} ${entry.date} ${entry.category} ${entry.title} ${entry.summary} ${entry.commit}`,
  }));
  const exportCurrent = () =>
    download(
      'nazca-changelog.md',
      'text/markdown;charset=utf-8',
      `# Nazca Railway changelog\n\nRange: ${startDate} through ${endDate}\n\n${filteredByDate
        .map(
          (entry) =>
            `## ${entry.version} · ${entry.title}\n\n${entry.date} · ${entry.category}\n\n${entry.summary}\n\nCommit: https://github.com/Ding-Ding-Projects/nazca/commit/${entry.commit}`,
        )
        .join('\n\n')}`,
    );
  return (
    <section aria-labelledby="changelog-title">
      <h2 id="changelog-title">Changelog</h2>
      <p className="tool-description">
        Every recorded development version links to the commit that completed
        it. No dates or entries are invented to fill gaps.
      </p>
      <div className="date-filter-row">
        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <button type="button" onClick={exportCurrent}>
          Export current range
        </button>
      </div>
      <SearchWorkbench
        surfaceId="changelog-search"
        label="Search changelog"
        placeholder="Find version, category, or change"
        records={searchRecords}
        onActivate={(record) =>
          document.getElementById(`change-${record.id}`)?.focus()
        }
      />
      <div className="release-code-card">
        <div>
          <strong>
            v0.1.0 code name: {releaseCodeName.en} · {releaseCodeName.zhHant}
          </strong>
          <p>
            The version remains the machine identity. The public dish photo is
            decoration and comes from the verified catalog release.
          </p>
        </div>
        <a
          href={releaseCodeName.releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open catalog release
        </a>
      </div>
      <ol className="history-list">
        {filteredByDate.toReversed().map((entry) => (
          <li id={`change-${entry.commit}`} tabIndex={-1} key={entry.commit}>
            <strong>
              {entry.version} · {entry.title}
            </strong>
            <span>
              {entry.date} · {entry.category}
            </span>
            <p>{entry.summary}</p>
            <a
              href={`https://github.com/Ding-Ding-Projects/nazca/commit/${entry.commit}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {entry.commit.slice(0, 8)}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

type SupportTicket = {
  id: string;
  number: string;
  category: string;
  description: string;
  severity: string;
  status: 'Created' | 'Triaged' | 'Resolved';
  createdAt: string;
};

function SupportTicketsTool() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [category, setCategory] = useState('Locked out');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('Monumental, according to the form');
  const [status, setStatus] = useState('Nothing has been sent anywhere.');

  useEffect(() => {
    loadPrivateValue<SupportTicket[]>('support-tickets')
      .then((records) =>
        setTickets(Array.isArray(records) ? records.slice(-5000) : []),
      )
      .catch(() => setStatus('Local ticket storage is unavailable.'));
  }, []);

  const persist = (records: SupportTicket[]) => {
    setTickets(records);
    savePrivateValue('support-tickets', records).catch(() =>
      setStatus('The ticket changed in memory but was not stored.'),
    );
  };

  const createTicket = () => {
    if (!description.trim()) {
      setStatus(
        'Describe the local problem before creating the fictional ticket.',
      );
      return;
    }
    const suffix = crypto
      .getRandomValues(new Uint16Array(1))[0]
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      number: `NR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${suffix}`,
      category,
      description: description.trim().slice(0, 2000),
      severity,
      status: 'Created',
      createdAt: new Date().toISOString(),
    };
    persist([...tickets, ticket]);
    setDescription('');
    setStatus(
      `${ticket.number} created locally. The desk has solemnly read the manual once.`,
    );
  };

  const advance = (id: string) => {
    persist(
      tickets.map((ticket) =>
        ticket.id === id
          ? {
              ...ticket,
              status:
                ticket.status === 'Created'
                  ? 'Triaged'
                  : ticket.status === 'Triaged'
                    ? 'Resolved'
                    : 'Resolved',
            }
          : ticket,
      ),
    );
  };

  const searchRecords = tickets.map((ticket) => ({
    id: ticket.id,
    title: ticket.number,
    subtitle: `${ticket.category} · ${ticket.status}`,
    text: `${ticket.number} ${ticket.category} ${ticket.description} ${ticket.severity} ${ticket.status}`,
  }));

  return (
    <section aria-labelledby="support-title">
      <h2 id="support-title">Support Tickets</h2>
      <p className="support-disclosure">
        Nothing is sent anywhere. No ticket exists outside this browser, no
        network request is made, no data is collected, and nobody is reading it.
      </p>
      <div className="tool-form-grid">
        <label>
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option>Locked out</option>
            <option>Browser storage</option>
            <option>Appearance regret</option>
            <option>Other local mystery</option>
          </select>
        </label>
        <label>
          Severity
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option>Monumental, according to the form</option>
            <option>Very serious in this tab</option>
            <option>The kettle can wait</option>
          </select>
        </label>
        <label>
          Description
          <textarea
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <button type="button" className="primary-action" onClick={createTicket}>
          Create local ticket
        </button>
      </div>
      <output className="tool-status">{status}</output>
      <div className="release-code-card">
        <div>
          <strong>Actual browser recovery</strong>
          <p>
            Clear stored data for origin{' '}
            <code>
              {typeof location === 'undefined' ? 'this site' : location.origin}
            </code>
            . Browsers do not allow a static page to open or delete their
            internal storage folder.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(location.origin)}
        >
          Copy origin
        </button>
      </div>
      <SearchWorkbench
        surfaceId="support-ticket-search"
        label="Search local tickets"
        placeholder="Find ticket number, category, or status"
        records={searchRecords}
        onActivate={(record) =>
          document.getElementById(`ticket-${record.id}`)?.focus()
        }
      />
      <ul className="notification-list">
        {tickets.toReversed().map((ticket) => (
          <li id={`ticket-${ticket.id}`} tabIndex={-1} key={ticket.id}>
            <strong>{ticket.number}</strong>
            <span>
              {ticket.category} · {ticket.severity} · {ticket.status}
            </span>
            <p>{ticket.description}</p>
            <p>
              {ticket.status === 'Created'
                ? 'Canned response: thank you for contacting the desk that exists entirely inside this browser.'
                : ticket.status === 'Triaged'
                  ? 'Triage found the documented recovery path. Nobody was paged.'
                  : 'Resolution: use browser site-data controls when you choose to reset.'}
            </p>
            <button
              type="button"
              disabled={ticket.status === 'Resolved'}
              onClick={() => advance(ticket.id)}
            >
              Advance status
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
