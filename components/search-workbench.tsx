'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RegexEvaluationResult } from '@/lib/search/regex-engine';

export type SearchRecord = {
  id: string;
  title: string;
  subtitle?: string;
  text: string;
};

type SearchWorkbenchProps = {
  surfaceId: string;
  label: string;
  placeholder: string;
  records: SearchRecord[];
  onActivate: (record: SearchRecord) => void;
  compact?: boolean;
};

function plainMatches(records: SearchRecord[], query: string) {
  const needle = query.normalize('NFKC').toLocaleLowerCase().trim();
  if (!needle) return [];
  return records.filter((record) =>
    record.text.normalize('NFKC').toLocaleLowerCase().includes(needle),
  );
}

export function SearchWorkbench({
  surfaceId,
  label,
  placeholder,
  records,
  onActivate,
  compact = false,
}: SearchWorkbenchProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'plain' | 'regex'>('plain');
  const [flags, setFlags] = useState('iu');
  const [replacement, setReplacement] = useState('$&');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [result, setResult] = useState<RegexEvaluationResult | null>(null);
  const [workerState, setWorkerState] = useState<
    'loading' | 'ready' | 'unavailable'
  >('loading');
  const [history, setHistory] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const builderButtonRef = useRef<HTMLButtonElement>(null);
  const patternRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('../lib/search/regex-worker.ts', import.meta.url),
        {
          type: 'module',
        },
      );
      worker.addEventListener(
        'message',
        (event: MessageEvent<RegexEvaluationResult>) => {
          if (event.data.requestId === requestId.current) setResult(event.data);
        },
      );
      worker.addEventListener('error', () => setWorkerState('unavailable'));
      workerRef.current = worker;
      setWorkerState('ready');
      return () => worker.terminate();
    } catch {
      setWorkerState('unavailable');
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (mode !== 'regex' || !query) {
      setResult(null);
      return;
    }
    requestId.current += 1;
    workerRef.current?.postMessage({
      requestId: requestId.current,
      pattern: query,
      flags,
      values: records.map((record) => record.text),
      replacement,
      maxMatches: 1000,
    });
  }, [flags, mode, query, records, replacement]);

  useEffect(() => {
    if (builderOpen) patternRef.current?.focus();
  }, [builderOpen]);

  const matches = useMemo(() => {
    if (!query) return [];
    if (mode === 'plain') return plainMatches(records, query);
    if (!result?.valid) return [];
    return result.matchedValueIndexes
      .map((index) => records[index])
      .filter(Boolean);
  }, [mode, query, records, result]);

  const closeBuilder = () => {
    setBuilderOpen(false);
    builderButtonRef.current?.focus();
  };

  const activate = (record: SearchRecord) => {
    setHistory((current) =>
      [query, ...current.filter((item) => item !== query)].slice(0, 8),
    );
    onActivate(record);
    setQuery('');
    setBuilderOpen(false);
  };

  const invalid =
    mode === 'regex' &&
    !!query &&
    (workerState === 'unavailable' || result?.valid === false);
  const resultId = `${surfaceId}-results`;
  const builderId = `${surfaceId}-builder`;
  const errorId = `${surfaceId}-error`;

  return (
    <div
      className={`search-workbench${compact ? ' search-workbench-compact' : ''}`}
      data-search-surface={surfaceId}
    >
      <div className="search-workbench-field" role="search">
        <label
          className={compact ? undefined : 'sr-only'}
          htmlFor={`${surfaceId}-input`}
        >
          {label}
        </label>
        <div className="search-row">
          <input
            ref={inputRef}
            id={`${surfaceId}-input`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 256))}
            placeholder={placeholder}
            aria-controls={query ? resultId : undefined}
            aria-invalid={invalid || undefined}
            aria-errormessage={invalid ? errorId : undefined}
          />
          <button
            ref={builderButtonRef}
            type="button"
            aria-label={`Open regular expression builder for ${label}`}
            aria-haspopup="dialog"
            aria-expanded={builderOpen}
            aria-controls={builderOpen ? builderId : undefined}
            onClick={() => setBuilderOpen((value) => !value)}
          >
            <Search size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {builderOpen ? (
        <section
          id={builderId}
          className="regex-popover regex-workbench"
          aria-label={`Regular expression builder for ${label}`}
        >
          <div className="popover-title">
            <div>
              <h2>RE2 regular expression workbench</h2>
              <p>
                Safe linear-time matching in a local Web Worker. Unicode mode is
                always active.
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Close regular expression builder"
              onClick={closeBuilder}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="regex-mode-row" role="group" aria-label="Search mode">
            <button
              type="button"
              aria-pressed={mode === 'plain'}
              onClick={() => setMode('plain')}
            >
              Plain text
            </button>
            <button
              type="button"
              aria-pressed={mode === 'regex'}
              onClick={() => setMode('regex')}
            >
              Regular expression
            </button>
          </div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor={`${surfaceId}-pattern`}>Pattern</label>
              <input
                ref={patternRef}
                id={`${surfaceId}-pattern`}
                value={query}
                maxLength={256}
                onChange={(event) => setQuery(event.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label htmlFor={`${surfaceId}-flags`}>Flags</label>
              <input
                id={`${surfaceId}-flags`}
                value={flags}
                onChange={(event) => setFlags(event.target.value.slice(0, 6))}
                spellCheck={false}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`${surfaceId}-replacement`}>
              Replacement preview
            </label>
            <input
              id={`${surfaceId}-replacement`}
              value={replacement}
              maxLength={256}
              onChange={(event) => setReplacement(event.target.value)}
            />
          </div>
          <div className="regex-capabilities">
            <strong>Dialect and capabilities</strong>
            <p>
              RE2/WASM 1.0.2. Flags: g, i, m, s, u, y. Named and numbered
              captures are supported. Backreferences and lookaround are visible
              but unsupported because RE2 avoids backtracking.
            </p>
          </div>
          <div
            className="regex-explanation"
            id={errorId}
            role={invalid ? 'alert' : 'status'}
          >
            {workerState === 'unavailable'
              ? 'The local RE2 worker is unavailable. Regex mode cannot run, and no unsafe fallback is used.'
              : mode === 'plain'
                ? 'Plain text is active. Switch modes to evaluate the current text as a pattern.'
                : result?.error
                  ? `Pattern error: ${result.error}`
                  : result
                    ? `Valid RE2 pattern. ${result.hits.length} matches across ${result.matchedValueIndexes.length} records in ${result.durationMs.toFixed(2)} ms${result.truncated ? '; output was capped at 1,000 matches' : ''}.`
                    : 'Enter a pattern to evaluate it locally.'}
            {result?.unsupported ? (
              <>
                <br />
                {result.unsupported}
              </>
            ) : null}
          </div>
          {result?.valid && result.hits.length ? (
            <div className="regex-detail-grid">
              <section>
                <h3>Capture table</h3>
                <div className="table-scroll" tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        <th>Record</th>
                        <th>Index</th>
                        <th>Match</th>
                        <th>Captures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.hits.slice(0, 20).map((hit, index) => (
                        <tr key={`${hit.valueIndex}-${hit.index}-${index}`}>
                          <td>{hit.valueIndex + 1}</td>
                          <td>{hit.index}</td>
                          <td>{hit.match || 'Zero-width'}</td>
                          <td>
                            {hit.captures
                              .map((capture) => capture ?? '∅')
                              .join(' · ') || 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h3>Replacement preview</h3>
                <pre>{result.replacementPreview}</pre>
              </section>
            </div>
          ) : null}
          <div className="regex-history">
            <strong>Local query history</strong>
            <div>
              {history.length ? (
                history.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setQuery(entry)}
                  >
                    {entry}
                  </button>
                ))
              ) : (
                <span>No saved queries in this session.</span>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {query && !builderOpen ? (
        <section
          id={resultId}
          className="search-results-popover"
          aria-label={`${label} results`}
        >
          <div aria-live="polite" className="sr-only">
            {invalid ? 'The pattern is invalid.' : `${matches.length} results`}
          </div>
          {invalid ? (
            <p className="empty-result" id={errorId}>
              {workerState === 'unavailable'
                ? 'Regex worker unavailable.'
                : result?.error}
            </p>
          ) : matches.length ? (
            <ul className="result-list">
              {matches.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    className="result-item"
                    onClick={() => activate(record)}
                  >
                    <span>
                      <strong>{record.title}</strong>
                      {record.subtitle ? <span>{record.subtitle}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-result">No results match “{query}”.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
