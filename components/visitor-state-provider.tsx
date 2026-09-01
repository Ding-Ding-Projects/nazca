'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearVocabulary,
  defaultVisitorState,
  loadVisitorState,
  loadVocabulary,
  saveVisitorState,
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

  useEffect(() => {
    let active = true;
    Promise.all([loadVisitorState(), loadVocabulary()])
      .then(([loadedState, loadedVocabulary]) => {
        if (!active) return;
        setState(loadedState);
        setVocabularyState(loadedVocabulary);
        setReady(true);
      })
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
    setState((current) => {
      const next = {
        ...current,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
        settings: { ...current.settings, ...patch },
      };
      saveVisitorState(next).catch((error) =>
        setStorageError(
          error instanceof Error
            ? error.message
            : 'The settings change was not saved.',
        ),
      );
      const channel = new BroadcastChannel('nazca-visitor-state');
      channel.postMessage({ revision: next.revision });
      channel.close();
      return next;
    });
  };

  const clearVocabularyState = async () => {
    await clearVocabulary();
    setVocabularyState([]);
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
      text(value) {
        if (state.settings.schoolMode.enabled || !vocabulary.length)
          return value;
        return vocabulary.reduce(
          (output, entry) => output.replaceAll(entry.from, entry.to),
          value,
        );
      },
    }),
    [ready, state, storageError, vocabulary],
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
