'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';
import { useVisitorState } from '@/components/visitor-state-provider';
import { publicPath } from '@/lib/public-path';

const commands: SearchRecord[] = [
  {
    id: 'home',
    title: 'Open Home',
    subtitle: 'Atlas overview',
    text: 'home atlas overview',
  },
  {
    id: 'settings',
    title: 'Open Settings',
    subtitle: 'Visitor preferences',
    text: 'settings visitor preferences language appearance narrator schedules',
  },
  {
    id: 'tools',
    title: 'Open Tools',
    subtitle: 'Local utilities',
    text: 'tools authenticator converter models history notifications exports',
  },
  {
    id: 'article',
    title: 'Open Nazca Railway article',
    subtitle: 'Reader fixture',
    text: 'Nazca Railway article reader source',
  },
  {
    id: 'notifications',
    title: 'Open notifications',
    subtitle: 'Review local notices',
    text: 'notifications review dismiss export',
  },
  {
    id: 'theme',
    title: 'Toggle theme',
    subtitle: 'Light or dark',
    text: 'theme light dark appearance',
  },
];

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, state, updateSettings } =
    useVisitorState();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLocaleLowerCase() === 'f'
      ) {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      requestAnimationFrame(() =>
        document.getElementById('command-palette-search-input')?.focus(),
      );
    }
  }, [paletteOpen]);

  const commandRecords = useMemo(() => commands, []);
  if (!paletteOpen) return null;

  const activate = (record: SearchRecord) => {
    if (record.id === 'theme') {
      updateSettings({
        theme: state.settings.theme === 'dark' ? 'light' : 'dark',
      });
    } else if (record.id === 'article') {
      window.location.assign(
        publicPath('/wiki/Nazca_Railway_(Los_Sengas_Division)'),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('nazca:navigate', { detail: record.id }),
      );
    }
    setPaletteOpen(false);
  };

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPaletteOpen(false);
      }}
    >
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
      >
        <div className="popover-title">
          <div>
            <h2 id="palette-title">Command palette</h2>
            <p>
              Search destinations, settings, tools, and exact local actions.
            </p>
          </div>
          <button
            ref={closeButton}
            className="icon-button"
            type="button"
            aria-label="Close command palette"
            onClick={() => setPaletteOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <SearchWorkbench
          surfaceId="command-palette-search"
          label="Search commands"
          placeholder="Type a command, destination, or setting"
          records={commandRecords}
          onActivate={activate}
        />
        <p className="palette-hint">
          <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> opens this palette.
        </p>
      </section>
    </div>
  );
}
