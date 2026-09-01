'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';
import {
  createElementLock,
  loadElementLocks,
  policyNeeds,
  saveElementLocks,
  verifyElementLock,
  type ElementLock,
  type LockPolicy,
} from '@/lib/element-locks';
import { loadPrivateValue, savePrivateValue } from '@/lib/visitor-state';

type Target = {
  element: HTMLElement;
  id: string;
  label: string;
  x: number;
  y: number;
};
type AppearanceOverride = {
  color: string;
  background: string;
  fontSize: number;
  radius: number;
};

const actions: SearchRecord[] = [
  {
    id: 'appearance',
    title: 'Edit appearance…',
    subtitle: 'Open a local non-destructive editor',
    text: 'edit appearance color background font size radius',
  },
  {
    id: 'lock',
    title: 'Lock this element…',
    subtitle: 'Create one independent local experience lock',
    text: 'lock element PIN password TOTP',
  },
  {
    id: 'copy',
    title: 'Copy element label',
    subtitle: 'Copy the accessible target label',
    text: 'copy element label clipboard',
  },
];

function targetLabel(element: HTMLElement) {
  return (
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120) ||
    element.tagName.toLocaleLowerCase()
  );
}

export function ContextMenuHost() {
  const [target, setTarget] = useState<Target | null>(null);
  const [panel, setPanel] = useState<'menu' | 'appearance' | 'lock' | 'unlock'>(
    'menu',
  );
  const [locks, setLocks] = useState<ElementLock[]>([]);
  const [appearances, setAppearances] = useState<
    Record<string, AppearanceOverride>
  >({});
  const [policy, setPolicy] = useState<LockPolicy>('pin');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [unlockDuration, setUnlockDuration] = useState('300');
  const [status, setStatus] = useState('');
  const [unlockedUntil, setUnlockedUntil] = useState<Record<string, number>>(
    {},
  );
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [appearance, setAppearance] = useState<AppearanceOverride>({
    color: '#172126',
    background: '#ffffff',
    fontSize: 16,
    radius: 8,
  });
  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      loadElementLocks(),
      loadPrivateValue<Record<string, AppearanceOverride>>(
        'appearance-overrides',
      ),
    ])
      .then(([storedLocks, storedAppearances]) => {
        setLocks(storedLocks);
        setAppearances(storedAppearances ?? {});
      })
      .catch(() =>
        setStatus('Local appearance or lock storage is unavailable.'),
      );
  }, []);

  useEffect(() => {
    let nextId = document.body.querySelectorAll('[data-element-id]').length;
    const apply = () => {
      document.body.querySelectorAll<HTMLElement>('*').forEach((element) => {
        if (
          element.closest('.context-layer') ||
          ['SCRIPT', 'STYLE', 'LINK', 'META'].includes(element.tagName)
        )
          return;
        if (!element.dataset.elementId) {
          element.dataset.elementId = `rendered-${String(nextId).padStart(5, '0')}-${element.tagName.toLocaleLowerCase()}`;
          nextId += 1;
        }
        const id = element.dataset.elementId;
        const override = appearances[id];
        if (override) {
          element.style.color = override.color;
          element.style.backgroundColor = override.background;
          element.style.fontSize = `${override.fontSize}px`;
          element.style.borderRadius = `${override.radius}px`;
        }
        element.dataset.locked = locks.some((lock) => lock.targetId === id)
          ? 'true'
          : 'false';
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [appearances, locks]);

  useEffect(() => {
    const resolve = (source: EventTarget | null) => {
      const element =
        source instanceof Element
          ? source.closest<HTMLElement>('[data-element-id]')
          : null;
      if (!element || element.closest('.context-layer')) return null;
      return element;
    };
    const open = (
      element: HTMLElement,
      x: number,
      y: number,
      nextPanel: typeof panel = 'menu',
    ) => {
      setTarget({
        element,
        id: element.dataset.elementId!,
        label: targetLabel(element),
        x,
        y,
      });
      setAppearance(
        appearances[element.dataset.elementId!] ?? {
          color: getComputedStyle(element).color,
          background: '#ffffff',
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize) || 16,
          radius:
            Number.parseFloat(getComputedStyle(element).borderRadius) || 0,
        },
      );
      setPanel(nextPanel);
      setStatus('');
    };
    const onContext = (event: MouseEvent) => {
      const element = resolve(event.target);
      if (!element) return;
      event.preventDefault();
      open(
        element,
        event.clientX,
        event.clientY,
        event.shiftKey ? 'appearance' : 'menu',
      );
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === 'F10') {
        const element = resolve(document.activeElement);
        if (!element) return;
        event.preventDefault();
        const rectangle = element.getBoundingClientRect();
        open(element, rectangle.left, rectangle.bottom);
        return;
      }
      if (!['Enter', ' '].includes(event.key)) return;
      const element = resolve(event.target);
      if (!element) return;
      const lock = locks.find(
        (candidate) => candidate.targetId === element.dataset.elementId,
      );
      if (!lock || (unlockedUntil[lock.id] ?? 0) > Date.now()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const rectangle = element.getBoundingClientRect();
      open(element, rectangle.left, rectangle.bottom, 'unlock');
    };
    const onClick = (event: MouseEvent) => {
      const element = resolve(event.target);
      if (!element) return;
      const lock = locks.find(
        (candidate) => candidate.targetId === element.dataset.elementId,
      );
      if (!lock || (unlockedUntil[lock.id] ?? 0) > Date.now()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open(element, event.clientX, event.clientY, 'unlock');
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      const element = resolve(event.target);
      if (!element) return;
      longPressTimer.current = window.setTimeout(
        () => open(element, event.clientX, event.clientY),
        650,
      );
    };
    const cancelLongPress = () => {
      if (longPressTimer.current !== null) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    };
    document.addEventListener('contextmenu', onContext, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', cancelLongPress, true);
    document.addEventListener('pointercancel', cancelLongPress, true);
    document.addEventListener('pointermove', cancelLongPress, true);
    return () => {
      document.removeEventListener('contextmenu', onContext, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', cancelLongPress, true);
      document.removeEventListener('pointercancel', cancelLongPress, true);
      document.removeEventListener('pointermove', cancelLongPress, true);
    };
  }, [appearances, locks, panel, unlockedUntil]);

  const activeLock = target
    ? locks.find((lock) => lock.targetId === target.id)
    : undefined;
  const menuRecords = useMemo(
    () =>
      activeLock
        ? [
            ...actions.filter((action) => action.id !== 'lock'),
            {
              id: 'remove-lock',
              title: 'Remove this lock…',
              subtitle: 'Remove the local experience lock',
              text: 'remove lock',
            },
            {
              id: 'relock',
              title: 'Lock again',
              subtitle: 'End the current timed unlock',
              text: 'relock lock again',
            },
          ]
        : actions,
    [activeLock],
  );

  if (!target) return null;

  const close = () => {
    const element = target.element;
    setTarget(null);
    requestAnimationFrame(() => element.focus());
  };

  const activateAction = async (record: SearchRecord) => {
    if (record.id === 'appearance') setPanel('appearance');
    else if (record.id === 'lock') setPanel('lock');
    else if (record.id === 'copy') {
      await navigator.clipboard.writeText(target.label);
      setStatus('Element label copied.');
    } else if (record.id === 'remove-lock' && activeLock) {
      const next = locks.filter((lock) => lock.id !== activeLock.id);
      await saveElementLocks(next);
      setLocks(next);
      setStatus('Lock removed.');
    } else if (record.id === 'relock' && activeLock) {
      setUnlockedUntil((current) => ({ ...current, [activeLock.id]: 0 }));
      setStatus('Element locked again.');
    }
  };

  const applyAppearance = async () => {
    const next = { ...appearances, [target.id]: appearance };
    setAppearances(next);
    await savePrivateValue('appearance-overrides', next);
    setStatus('Appearance saved locally.');
  };

  const saveLock = async () => {
    try {
      const lock = await createElementLock({
        targetId: target.id,
        label: target.label,
        policy,
        pin,
        password,
        totpSecret: totp,
      });
      const next = [
        ...locks.filter((candidate) => candidate.targetId !== target.id),
        lock,
      ];
      await saveElementLocks(next);
      setLocks(next);
      setPin('');
      setPassword('');
      setTotp('');
      setStatus('Independent local lock created. It is for fun, not security.');
      setPanel('menu');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Lock creation failed.',
      );
    }
  };

  const unlock = async () => {
    if (!activeLock) return;
    if (blockedUntil > Date.now()) {
      setStatus(
        `Try again after ${new Date(blockedUntil).toLocaleTimeString()}.`,
      );
      return;
    }
    const matched = await verifyElementLock(activeLock, {
      pin,
      password,
      totp,
    });
    if (!matched) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setBlockedUntil(Date.now() + 30_000);
        setAttempts(0);
      }
      setStatus(
        'The local credential did not match. Clearing this origin’s storage is recovery.',
      );
      return;
    }
    const duration =
      unlockDuration === 'session'
        ? Number.POSITIVE_INFINITY
        : Number(unlockDuration) * 1000;
    setUnlockedUntil((current) => ({
      ...current,
      [activeLock.id]:
        duration === 0 ? Date.now() + 1000 : Date.now() + duration,
    }));
    setPin('');
    setPassword('');
    setTotp('');
    setStatus('Unlocked. Activate the element again.');
    setPanel('menu');
  };

  const x = Math.max(
    8,
    Math.min(
      target.x,
      window.innerWidth - Math.min(460, window.innerWidth - 16),
    ),
  );
  const y = Math.max(8, Math.min(target.y, window.innerHeight - 180));

  return (
    <div className="context-layer">
      <dialog
        open
        className="element-context-panel"
        style={{ left: x, top: y }}
        aria-label={`Actions for ${target.label}`}
      >
        <div className="context-heading">
          <div>
            <strong>{target.label}</strong>
            <span>{target.id}</span>
          </div>
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
        {panel === 'menu' ? (
          <>
            <SearchWorkbench
              surfaceId="element-context-search"
              label="Search element actions"
              placeholder="Find an action"
              records={menuRecords}
              onActivate={activateAction}
            />
            <div className="context-actions">
              {menuRecords.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  onClick={() => activateAction(record)}
                >
                  <span>{record.title}</span>
                  {record.id === 'appearance' ? <kbd>Shift+F10</kbd> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {panel === 'appearance' ? (
          <AppearanceEditor
            appearance={appearance}
            setAppearance={setAppearance}
            apply={applyAppearance}
            back={() => setPanel('menu')}
          />
        ) : null}
        {panel === 'lock' ? (
          <LockEditor
            policy={policy}
            setPolicy={setPolicy}
            pin={pin}
            setPin={setPin}
            password={password}
            setPassword={setPassword}
            totp={totp}
            setTotp={setTotp}
            save={saveLock}
            back={() => setPanel('menu')}
          />
        ) : null}
        {panel === 'unlock' && activeLock ? (
          <UnlockEditor
            lock={activeLock}
            pin={pin}
            setPin={setPin}
            password={password}
            setPassword={setPassword}
            totp={totp}
            setTotp={setTotp}
            duration={unlockDuration}
            setDuration={setUnlockDuration}
            unlock={unlock}
            support={() => {
              window.dispatchEvent(
                new CustomEvent('nazca:navigate', { detail: 'tools' }),
              );
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent('nazca:open-tool', { detail: 'support' }),
                  ),
                0,
              );
              close();
            }}
          />
        ) : null}
        {status ? <output className="context-status">{status}</output> : null}
      </dialog>
    </div>
  );
}

function AppearanceEditor({
  appearance,
  setAppearance,
  apply,
  back,
}: {
  appearance: AppearanceOverride;
  setAppearance: (value: AppearanceOverride) => void;
  apply: () => void;
  back: () => void;
}) {
  const properties: SearchRecord[] = [
    {
      id: 'appearance-color',
      title: 'Text color',
      text: 'text foreground color',
    },
    {
      id: 'appearance-background',
      title: 'Background color',
      text: 'background fill color',
    },
    {
      id: 'appearance-font-size',
      title: 'Font size',
      text: 'font typography size',
    },
    {
      id: 'appearance-radius',
      title: 'Corner radius',
      text: 'corner shape radius',
    },
  ];
  return (
    <div className="context-editor">
      <SearchWorkbench
        surfaceId="appearance-property-search"
        label="Search appearance properties"
        placeholder="Find a property"
        records={properties}
        onActivate={(record) => document.getElementById(record.id)?.focus()}
      />
      <label>
        Text color
        <input
          id="appearance-color"
          type="color"
          value={
            appearance.color.startsWith('#') ? appearance.color : '#172126'
          }
          onChange={(event) =>
            setAppearance({ ...appearance, color: event.target.value })
          }
        />
      </label>
      <label>
        Background color
        <input
          id="appearance-background"
          type="color"
          value={appearance.background}
          onChange={(event) =>
            setAppearance({ ...appearance, background: event.target.value })
          }
        />
      </label>
      <label>
        Font size
        <input
          id="appearance-font-size"
          type="range"
          min="8"
          max="72"
          value={appearance.fontSize}
          onChange={(event) =>
            setAppearance({
              ...appearance,
              fontSize: Number(event.target.value),
            })
          }
        />
        <output>{appearance.fontSize}px</output>
      </label>
      <label>
        Corner radius
        <input
          id="appearance-radius"
          type="range"
          min="0"
          max="64"
          value={appearance.radius}
          onChange={(event) =>
            setAppearance({ ...appearance, radius: Number(event.target.value) })
          }
        />
        <output>{appearance.radius}px</output>
      </label>
      <div className="tool-actions">
        <button type="button" onClick={back}>
          Back
        </button>
        <button type="button" onClick={apply}>
          Apply locally
        </button>
      </div>
    </div>
  );
}

function PinKeypad({
  value,
  setValue,
}: {
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div className="pin-keypad" aria-label="PIN keypad">
      {[
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        'Clear',
        '0',
        'Backspace',
      ].map((key) => (
        <button
          type="button"
          key={key}
          aria-label={key}
          onClick={() =>
            key === 'Clear'
              ? setValue('')
              : key === 'Backspace'
                ? setValue(value.slice(0, -1))
                : setValue(`${value}${key}`.slice(0, 32))
          }
        >
          {key}
        </button>
      ))}
    </div>
  );
}

function LockEditor({
  policy,
  setPolicy,
  pin,
  setPin,
  password,
  setPassword,
  totp,
  setTotp,
  save,
  back,
}: {
  policy: LockPolicy;
  setPolicy: (value: LockPolicy) => void;
  pin: string;
  setPin: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  totp: string;
  setTotp: (value: string) => void;
  save: () => void;
  back: () => void;
}) {
  return (
    <div className="context-editor">
      <p className="lock-disclosure">
        This is a local experience lock for fun. It is not encryption or
        protection from another person using this browser.
      </p>
      <label>
        Policy
        <select
          value={policy}
          onChange={(event) => setPolicy(event.target.value as LockPolicy)}
        >
          <option value="pin">PIN</option>
          <option value="password">Password</option>
          <option value="pin-password">PIN plus password</option>
          <option value="password-totp">Password plus TOTP</option>
          <option value="pin-totp">PIN plus TOTP</option>
          <option value="password-pin-totp">Password plus PIN plus TOTP</option>
        </select>
      </label>
      {policyNeeds(policy, 'pin') ? (
        <>
          <label>
            PIN
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
          <PinKeypad value={pin} setValue={setPin} />
        </>
      ) : null}
      {policyNeeds(policy, 'password') ? (
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      ) : null}
      {policyNeeds(policy, 'totp') ? (
        <label>
          Manual Base32 TOTP secret
          <input
            type="password"
            value={totp}
            onChange={(event) => setTotp(event.target.value)}
          />
        </label>
      ) : null}
      <p>
        Recovery: clear this origin’s browser storage. Credentials never enter
        normal exports or history.
      </p>
      <div className="tool-actions">
        <button type="button" onClick={back}>
          Cancel
        </button>
        <button type="button" onClick={save}>
          Create lock
        </button>
      </div>
    </div>
  );
}

function UnlockEditor({
  lock,
  pin,
  setPin,
  password,
  setPassword,
  totp,
  setTotp,
  duration,
  setDuration,
  unlock,
  support,
}: {
  lock: ElementLock;
  pin: string;
  setPin: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  totp: string;
  setTotp: (value: string) => void;
  duration: string;
  setDuration: (value: string) => void;
  unlock: () => void;
  support: () => void;
}) {
  return (
    <div className="context-editor">
      <h3>Unlock {lock.label}</h3>
      <p className="lock-disclosure">
        This lock is for fun. Clearing this origin’s browser storage resets it.
      </p>
      {policyNeeds(lock.policy, 'pin') ? (
        <>
          <label>
            PIN
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
          <PinKeypad value={pin} setValue={setPin} />
        </>
      ) : null}
      {policyNeeds(lock.policy, 'password') ? (
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      ) : null}
      {policyNeeds(lock.policy, 'totp') ? (
        <label>
          Current TOTP code
          <input
            inputMode="numeric"
            value={totp}
            onChange={(event) => setTotp(event.target.value)}
          />
        </label>
      ) : null}
      <label>
        Unlock duration
        <select
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        >
          <option value="0">This activation</option>
          <option value="300">5 minutes</option>
          <option value="1800">30 minutes</option>
          <option value="session">Until this page closes</option>
        </select>
      </label>
      <div className="tool-actions">
        <button type="button" onClick={support}>
          Forgotten your password? Support Tickets
        </button>
        <button type="button" onClick={unlock}>
          Unlock
        </button>
      </div>
    </div>
  );
}
