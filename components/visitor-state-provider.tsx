'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  clearVocabulary,
  defaultVisitorState,
  loadHistory,
  loadNotifications,
  loadVisitorState,
  loadVocabulary,
  saveVisitorState,
  saveHistory,
  saveNotifications,
  type HistoryRecord,
  type NotificationRecord,
  type VisitorSettings,
  type VisitorState,
  type VocabularyEntry,
} from '@/lib/visitor-state';

type VisitorContextValue = {
  state: VisitorState;
  ready: boolean;
  storageError: string | null;
  vocabulary: VocabularyEntry[];
  updateSettings: (patch: Partial<VisitorSettings>) => void;
  setVocabulary: (entries: VocabularyEntry[]) => void;
  clearVocabularyState: () => Promise<void>;
  text: (value: string) => string;
  notifications: NotificationRecord[];
  history: HistoryRecord[];
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  notify: (
    record: Omit<NotificationRecord, 'id' | 'createdAt' | 'dismissed'>,
  ) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  exportVisitorData: () => string;
};

const VisitorContext = createContext<VisitorContextValue | null>(null);

export function VisitorStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState(defaultVisitorState);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [vocabulary, setVocabularyState] = useState<VocabularyEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const stateRef = useRef(state);
  const historyRef = useRef(history);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadVisitorState(),
      loadVocabulary(),
      loadNotifications(),
      loadHistory(),
    ])
      .then(
        ([
          loadedState,
          loadedVocabulary,
          loadedNotifications,
          loadedHistory,
        ]) => {
          if (!active) return;
          setState(loadedState);
          setVocabularyState(loadedVocabulary);
          setNotifications(loadedNotifications);
          setHistory(loadedHistory);
          setReady(true);
        },
      )
      .catch((error) => {
        if (!active) return;
        setStorageError(
          error instanceof Error
            ? error.message
            : 'Browser storage is unavailable.',
        );
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return undefined;
    const channel = new BroadcastChannel('nazca-visitor-state');
    channel.addEventListener(
      'message',
      (event: MessageEvent<{ revision: number }>) => {
        if (event.data.revision <= state.revision) return;
        loadVisitorState()
          .then(setState)
          .catch(() => undefined);
      },
    );
    return () => channel.close();
  }, [state.revision]);

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const dark =
      state.settings.theme === 'dark' ||
      (state.settings.theme === 'system' && systemDark);
    root.classList.toggle('dark', dark);
    root.classList.toggle(
      'low-stimulation',
      state.settings.attention.lowStimulation,
    );
    root.classList.toggle('focus-mode', state.settings.attention.focus);
    root.dataset.density = state.settings.density;
    root.lang =
      state.settings.schoolMode.enabled || state.settings.languageMode === 'en'
        ? 'en'
        : state.settings.languageMode === 'zh-HK'
          ? 'zh-HK'
          : 'en';
    root.style.setProperty('--primary', state.settings.seedColor);
    localStorage.setItem('nazca.boot.theme', state.settings.theme);
  }, [
    state.settings.attention.focus,
    state.settings.attention.lowStimulation,
    state.settings.density,
    state.settings.languageMode,
    state.settings.schoolMode.enabled,
    state.settings.seedColor,
    state.settings.theme,
  ]);

  const updateSettings = (patch: Partial<VisitorSettings>) => {
    const current = stateRef.current;
    const next = {
      ...current,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      settings: { ...current.settings, ...patch },
    };
    stateRef.current = next;
    setState(next);
    saveVisitorState(next).catch((error) =>
      setStorageError(
        error instanceof Error
          ? error.message
          : 'The settings change was not saved.',
      ),
    );
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('nazca-visitor-state');
      channel.postMessage({ revision: next.revision });
      channel.close();
    }
    const event: HistoryRecord = {
      id: crypto.randomUUID(),
      sequence: historyRef.current.length
        ? historyRef.current.at(-1)!.sequence + 1
        : 1,
      action: 'settings changed',
      target: Object.keys(patch).join(', '),
      timestamp: next.updatedAt,
      summary: `Updated ${Object.keys(patch).join(', ')}. Sensitive values are omitted.`,
    };
    const updatedHistory = [...historyRef.current, event].slice(-20_000);
    historyRef.current = updatedHistory;
    setHistory(updatedHistory);
    saveHistory(updatedHistory).catch(() => undefined);
  };

  const clearVocabularyState = async () => {
    await clearVocabulary();
    setVocabularyState([]);
  };

  const notify: VisitorContextValue['notify'] = (record) => {
    const created: NotificationRecord = {
      ...record,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      dismissed: false,
    };
    setNotifications((records) => {
      const updated = [...records, created].slice(-10_000);
      saveNotifications(updated).catch(() => undefined);
      return updated;
    });
  };

  const dismissNotification = (id: string) => {
    setNotifications((records) => {
      const updated = records.map((record) =>
        record.id === id ? { ...record, dismissed: true } : record,
      );
      saveNotifications(updated).catch(() => undefined);
      return updated;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    saveNotifications([]).catch(() => undefined);
  };

  const value = useMemo<VisitorContextValue>(
    () => ({
      state,
      ready,
      storageError,
      vocabulary,
      updateSettings,
      setVocabulary: setVocabularyState,
      clearVocabularyState,
      notifications,
      history,
      paletteOpen,
      setPaletteOpen,
      notify,
      dismissNotification,
      clearNotifications,
      exportVisitorData() {
        return JSON.stringify(
          {
            schemaVersion: '1.0.0',
            exportedAt: new Date().toISOString(),
            state,
            notifications,
            history,
            omitted: [
              'personal vocabulary',
              'local credentials',
              'authenticator secrets',
            ],
          },
          null,
          2,
        );
      },
      text(value) {
        if (state.settings.schoolMode.enabled || !vocabulary.length)
          return value;
        return vocabulary.reduce(
          (output, entry) => output.replaceAll(entry.from, entry.to),
          value,
        );
      },
    }),
    [
      history,
      notifications,
      paletteOpen,
      ready,
      state,
      storageError,
      vocabulary,
    ],
  );

  return (
    <VisitorContext.Provider value={value}>{children}</VisitorContext.Provider>
  );
}

export function useVisitorState() {
  const value = useContext(VisitorContext);
  if (!value)
    throw new Error(
      'useVisitorState must be used inside VisitorStateProvider.',
    );
  return value;
}
