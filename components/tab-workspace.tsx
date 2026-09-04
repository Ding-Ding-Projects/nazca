'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Pin,
  PinOff,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SearchWorkbench,
  type SearchMatchSummary,
  type SearchRecord,
} from '@/components/search-workbench';
import { loadPrivateValue, savePrivateValue } from '@/lib/visitor-state';

export type WorkspaceTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  count: string;
};

export type WorkspaceTabGroup = {
  label: string;
  items: readonly WorkspaceTab[];
};

type DockEdge = 'left' | 'right' | 'top' | 'bottom';
type GroupState = {
  id: string;
  label: string;
  color: string;
  collapsed: boolean;
  tabIds: string[];
};
type TabWorkspaceState = {
  version: 1;
  edge: DockEdge;
  compact: boolean;
  pinned: string[];
  groups: GroupState[];
  queries: Record<string, string>;
};

const STORAGE_KEY = 'tab-workspace-v1';
const COLORS = ['#116c79', '#a84331', '#278e6a', '#936718', '#6557a8'];
const EDGES: { id: DockEdge; label: string; icon: typeof PanelLeft }[] = [
  { id: 'left', label: 'Dock left', icon: PanelLeft },
  { id: 'right', label: 'Dock right', icon: PanelRight },
  { id: 'top', label: 'Dock top', icon: PanelTop },
  { id: 'bottom', label: 'Dock bottom', icon: PanelBottom },
];

function initialState(groups: readonly WorkspaceTabGroup[]): TabWorkspaceState {
  return {
    version: 1,
    edge: 'left',
    compact: false,
    pinned: [],
    groups: groups.map((group, index) => ({
      id: group.label.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
      label: group.label,
      color: COLORS[index % COLORS.length],
      collapsed: false,
      tabIds: group.items.map((item) => item.id),
    })),
    queries: {},
  };
}

function parseState(value: unknown, fallback: TabWorkspaceState) {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<TabWorkspaceState>;
  if (
    candidate.version !== 1 ||
    !['left', 'right', 'top', 'bottom'].includes(candidate.edge ?? '') ||
    !Array.isArray(candidate.groups) ||
    !Array.isArray(candidate.pinned)
  ) {
    return fallback;
  }
  return {
    version: 1,
    edge: candidate.edge as DockEdge,
    compact: candidate.compact === true,
    pinned: candidate.pinned.filter(
      (id): id is string => typeof id === 'string',
    ),
    groups: candidate.groups
      .filter(
        (group): group is GroupState =>
          !!group &&
          typeof group.id === 'string' &&
          typeof group.label === 'string' &&
          typeof group.color === 'string' &&
          typeof group.collapsed === 'boolean' &&
          Array.isArray(group.tabIds),
      )
      .map((group) => ({
        ...group,
        tabIds: group.tabIds.filter((id) => typeof id === 'string'),
      })),
    queries:
      candidate.queries && typeof candidate.queries === 'object'
        ? Object.fromEntries(
            Object.entries(candidate.queries).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === 'string',
            ),
          )
        : {},
  };
}

function move<T>(items: T[], from: number, to: number) {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function TabWorkspace({
  groups,
  activeTab,
  onActivate,
  labelFor,
}: {
  groups: readonly WorkspaceTabGroup[];
  activeTab: string;
  onActivate: (id: string) => void;
  labelFor: (id: string, fallback: string) => string;
}) {
  const tabs = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const tabsById = useMemo(
    () => new Map(tabs.map((tab) => [tab.id, tab])),
    [tabs],
  );
  const [state, setState] = useState(() => initialState(groups));
  const [ready, setReady] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [moveTabId, setMoveTabId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState<
    'containing' | 'not-containing' | null
  >(null);
  const [bulkSummary, setBulkSummary] = useState<SearchMatchSummary>({
    query: '',
    mode: 'plain',
    invalid: false,
    ids: [],
  });
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fallback = initialState(groups);
    loadPrivateValue<unknown>(STORAGE_KEY)
      .then((stored) => setState(parseState(stored, fallback)))
      .catch(() => setState(fallback))
      .finally(() => setReady(true));
  }, [groups]);

  useEffect(() => {
    if (!ready) return;
    savePrivateValue(STORAGE_KEY, state).catch(() => undefined);
  }, [ready, state]);

  const setQuery = (key: string, value: string) =>
    setState((current) => ({
      ...current,
      queries: { ...current.queries, [key]: value.slice(0, 256) },
    }));
  const persistedSearch = (key: string) => ({
    initialQuery: state.queries[key] ?? '',
    onQueryChange: (query: string) => setQuery(key, query),
  });
  const recordsFor = (ids: string[]): SearchRecord[] =>
    ids
      .map((id) => tabsById.get(id))
      .filter((tab): tab is WorkspaceTab => !!tab)
      .map((tab) => ({
        id: tab.id,
        title: labelFor(tab.id, tab.label),
        subtitle: `${state.pinned.includes(tab.id) ? 'Pinned · ' : ''}${tab.count || 'Open tab'}`,
        text: `${tab.id} ${labelFor(tab.id, tab.label)} ${tab.label}`,
      }));
  const orderedGroups = state.groups
    .map((group) => ({
      ...group,
      tabIds: group.tabIds.filter((id) => tabsById.has(id)),
    }))
    .filter((group) => group.tabIds.length || group.id.startsWith('group-'));
  const allGrouped = new Set(orderedGroups.flatMap((group) => group.tabIds));
  const ungrouped = tabs
    .filter((tab) => !allGrouped.has(tab.id))
    .map((tab) => tab.id);
  const allRecords = recordsFor([
    ...state.pinned,
    ...orderedGroups.flatMap((group) => group.tabIds),
    ...ungrouped,
  ]);
  const pinnedRecords = recordsFor(state.pinned);
  const bulkMatches = allRecords.filter((record) => {
    if (!bulkSummary.query.trim()) return false;
    const matched = bulkSummary.ids.includes(record.id);
    return bulkMode === 'not-containing' ? !matched : matched;
  });
  const protectedIds = new Set(state.pinned);
  const onBulkSummaryChange = useCallback((summary: SearchMatchSummary) => {
    setBulkSummary((current) =>
      current.query === summary.query &&
      current.mode === summary.mode &&
      current.invalid === summary.invalid &&
      current.ids.join('\u0000') === summary.ids.join('\u0000')
        ? current
        : summary,
    );
  }, []);

  const activate = (id: string) => {
    onActivate(id);
    setManagerOpen(false);
    setMoveTabId(null);
    setBulkMode(null);
  };
  const togglePin = (id: string) =>
    setState((current) => ({
      ...current,
      pinned: current.pinned.includes(id)
        ? current.pinned.filter((item) => item !== id)
        : [...current.pinned, id],
    }));
  const moveInto = (tabId: string, groupId: string) => {
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) => ({
        ...group,
        tabIds:
          group.id === groupId
            ? [...group.tabIds.filter((id) => id !== tabId), tabId]
            : group.tabIds.filter((id) => id !== tabId),
      })),
    }));
    setMoveTabId(null);
  };
  const createGroup = () => {
    const label = newGroupLabel.trim();
    if (!label) return;
    setState((current) => ({
      ...current,
      groups: [
        ...current.groups,
        {
          id: `group-${crypto.randomUUID()}`,
          label: label.slice(0, 80),
          color: COLORS[current.groups.length % COLORS.length],
          collapsed: false,
          tabIds: [],
        },
      ],
    }));
    setNewGroupLabel('');
  };
  const updateOneGroup = (
    groupId: string,
    update: (group: GroupState) => GroupState,
  ) =>
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === groupId ? update(group) : group,
      ),
    }));
  const moveGroup = (from: number, to: number) =>
    setState((current) => ({
      ...current,
      groups: move(current.groups, from, to),
    }));
  const closeBulk = () => {
    const closable = bulkMatches
      .map((record) => record.id)
      .filter((id) => !protectedIds.has(id));
    if (!closable.length) return;
    const next = allRecords.find((record) => !closable.includes(record.id));
    if (closable.includes(activeTab) && next) onActivate(next.id);
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) => ({
        ...group,
        tabIds: group.tabIds.filter((id) => !closable.includes(id)),
      })),
      pinned: current.pinned.filter((id) => !closable.includes(id)),
    }));
    setBulkMode(null);
    setBulkSummary({ query: '', mode: 'plain', invalid: false, ids: [] });
  };

  return (
    <nav
      className={`tab-dock tab-workspace tab-dock-${state.edge}${state.compact ? ' tab-dock-compact' : ''}`}
      aria-label="Atlas tabs"
      aria-orientation={
        state.edge === 'left' || state.edge === 'right'
          ? 'vertical'
          : 'horizontal'
      }
      data-tab-edge={state.edge}
    >
      <div className="tab-workspace-toolbar">
        <button
          ref={opener}
          type="button"
          className="tab-workspace-toolbar-button"
          onClick={() => setManagerOpen((open) => !open)}
          aria-expanded={managerOpen}
          aria-controls="tab-management-panel"
        >
          <Settings2 size={16} aria-hidden="true" />
          <span>Manage tabs</span>
        </button>
        <button
          type="button"
          className="tab-workspace-toolbar-button"
          onClick={() =>
            setState((current) => ({ ...current, compact: !current.compact }))
          }
          aria-pressed={state.compact}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>{state.compact ? 'Expand dock' : 'Collapse dock'}</span>
        </button>
      </div>

      {managerOpen ? (
        <section
          className="tab-management-panel"
          id="tab-management-panel"
          aria-label="Tab management"
        >
          <div className="tab-management-heading">
            <strong>Tab workspace</strong>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setManagerOpen(false);
                opener.current?.focus();
              }}
              aria-label="Close tab management"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <fieldset className="dock-edge-picker">
            <legend>Dock edge</legend>
            {EDGES.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={state.edge === id}
                onClick={() =>
                  setState((current) => ({ ...current, edge: id }))
                }
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </fieldset>
          <SearchWorkbench
            surfaceId="tab-strip-search"
            label="Search current tab strip"
            placeholder="Find an open tab"
            records={allRecords}
            onActivate={(record) => activate(record.id)}
            compact
            {...persistedSearch('search.tabs.strip')}
          />
          <SearchWorkbench
            surfaceId="master-tab-search"
            label="Search all tabs and groups"
            placeholder="Find tabs across all groups"
            records={allRecords.map((record) => ({
              ...record,
              subtitle: `${record.subtitle ?? ''} · ${orderedGroups.find((group) => group.tabIds.includes(record.id))?.label ?? 'Ungrouped'}`,
            }))}
            onActivate={(record) => activate(record.id)}
            compact
            {...persistedSearch('search.tabs.master')}
          />
          <SearchWorkbench
            surfaceId="group-search"
            label="Search group names"
            placeholder="Find a tab group"
            records={orderedGroups.map((group) => ({
              id: group.id,
              title: group.label,
              subtitle: `${group.tabIds.length} tabs`,
              text: `${group.label} ${group.tabIds.map((id) => tabsById.get(id)?.label).join(' ')}`,
            }))}
            onActivate={(record) => {
              document
                .getElementById(`tab-group-${record.id}`)
                ?.scrollIntoView({ block: 'nearest' });
              setManagerOpen(false);
            }}
            compact
            {...persistedSearch('search.groups')}
          />
          <div className="tab-create-group">
            <input
              value={newGroupLabel}
              onChange={(event) => setNewGroupLabel(event.target.value)}
              placeholder="New group name"
              aria-label="New tab group name"
              maxLength={80}
            />
            <button type="button" onClick={createGroup}>
              <Plus size={16} aria-hidden="true" />
              Create group
            </button>
          </div>
          <div className="tab-bulk-actions">
            <button type="button" onClick={() => setBulkMode('containing')}>
              Close tabs containing text
            </button>
            <button type="button" onClick={() => setBulkMode('not-containing')}>
              Close tabs not containing text
            </button>
          </div>
        </section>
      ) : null}

      {pinnedRecords.length ? (
        <section className="tab-pinned-region" aria-label="Pinned tabs">
          <p className="dock-label">Pinned</p>
          <div className="tab-list">
            {pinnedRecords.map((record, index) => (
              <div className="tab-row" key={record.id}>
                <button
                  type="button"
                  className="tab-button"
                  aria-current={activeTab === record.id ? 'page' : undefined}
                  onClick={() => activate(record.id)}
                  title={record.title}
                >
                  <Pin size={14} aria-hidden="true" />
                  <span>{record.title}</span>
                </button>
                <div className="tab-row-actions">
                  <button
                    type="button"
                    aria-label={`Move ${record.title} earlier`}
                    disabled={!index}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        pinned: move(current.pinned, index, index - 1),
                      }))
                    }
                  >
                    <ChevronUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${record.title} later`}
                    disabled={index === pinnedRecords.length - 1}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        pinned: move(current.pinned, index, index + 1),
                      }))
                    }
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Unpin ${record.title}`}
                    onClick={() => togglePin(record.id)}
                  >
                    <PinOff size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {orderedGroups.map((group, groupIndex) => {
        const groupRecords = recordsFor(group.tabIds);
        return (
          <section
            key={group.id}
            id={`tab-group-${group.id}`}
            className="tab-group"
            style={{ '--tab-group-color': group.color } as CSSProperties}
          >
            <div className="tab-group-heading">
              <button
                type="button"
                className="tab-group-toggle"
                aria-expanded={!group.collapsed}
                onClick={() =>
                  updateOneGroup(group.id, (candidate) => ({
                    ...candidate,
                    collapsed: !candidate.collapsed,
                  }))
                }
              >
                <span className="tab-group-dot" aria-hidden="true" />
                {group.label}
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              <span>{groupRecords.length}</span>
              <button
                type="button"
                aria-label={`Move ${group.label} earlier`}
                disabled={!groupIndex}
                onClick={() => moveGroup(groupIndex, groupIndex - 1)}
              >
                <ChevronUp size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Move ${group.label} later`}
                disabled={groupIndex === orderedGroups.length - 1}
                onClick={() => moveGroup(groupIndex, groupIndex + 1)}
              >
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </div>
            {!group.collapsed ? (
              <>
                <SearchWorkbench
                  surfaceId={`tab-group-search-${group.id}`}
                  label={`Search ${group.label} tabs`}
                  placeholder={`Search ${group.label}`}
                  records={groupRecords}
                  onActivate={(record) => activate(record.id)}
                  compact
                  {...persistedSearch(`search.tabs.group.${group.id}`)}
                />
                <div className="tab-group-controls">
                  <input
                    value={group.label}
                    onChange={(event) =>
                      updateOneGroup(group.id, (candidate) => ({
                        ...candidate,
                        label: event.target.value.slice(0, 80),
                      }))
                    }
                    aria-label={`Rename ${group.label}`}
                  />
                  <input
                    type="color"
                    value={group.color}
                    aria-label={`Set ${group.label} color`}
                    onChange={(event) =>
                      updateOneGroup(group.id, (candidate) => ({
                        ...candidate,
                        color: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="tab-list">
                  {groupRecords.map((record, index) => {
                    const tab = tabsById.get(record.id)!;
                    const Icon = tab.icon;
                    return (
                      <div className="tab-row" key={record.id}>
                        <button
                          type="button"
                          className="tab-button"
                          aria-current={
                            activeTab === record.id ? 'page' : undefined
                          }
                          onClick={() => activate(record.id)}
                          title={record.title}
                        >
                          <span className="tab-icon">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span>{record.title}</span>
                          {tab.count ? (
                            <span className="tab-count">{tab.count}</span>
                          ) : null}
                        </button>
                        <div className="tab-row-actions">
                          <button
                            type="button"
                            aria-label={`Move ${record.title} earlier`}
                            disabled={!index}
                            onClick={() =>
                              updateOneGroup(group.id, (candidate) => ({
                                ...candidate,
                                tabIds: move(
                                  candidate.tabIds,
                                  index,
                                  index - 1,
                                ),
                              }))
                            }
                          >
                            <GripVertical size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`${state.pinned.includes(record.id) ? 'Unpin' : 'Pin'} ${record.title}`}
                            onClick={() => togglePin(record.id)}
                          >
                            {state.pinned.includes(record.id) ? (
                              <PinOff size={14} aria-hidden="true" />
                            ) : (
                              <Pin size={14} aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${record.title} into another group`}
                            onClick={() => setMoveTabId(record.id)}
                          >
                            <ChevronRight size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </section>
        );
      })}

      {moveTabId ? (
        <section className="tab-move-picker" aria-label="Move tab into group">
          <div className="tab-management-heading">
            <strong>Move {tabsById.get(moveTabId)?.label} into group</strong>
            <button
              type="button"
              className="icon-button"
              onClick={() => setMoveTabId(null)}
              aria-label="Close group picker"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <SearchWorkbench
            surfaceId="move-into-group-search"
            label="Search groups to move into"
            placeholder="Filter group destinations"
            records={orderedGroups.map((group) => ({
              id: group.id,
              title: group.label,
              subtitle: `${group.tabIds.length} members`,
              text: `${group.label} ${group.tabIds.map((id) => tabsById.get(id)?.label).join(' ')}`,
            }))}
            onActivate={(record) => moveInto(moveTabId, record.id)}
            compact
            {...persistedSearch('search.tabs.move-picker')}
          />
          {orderedGroups.map((group) => (
            <button
              type="button"
              className="move-group-option"
              key={group.id}
              onClick={() => moveInto(moveTabId, group.id)}
            >
              <span
                className="tab-group-dot"
                style={{ background: group.color }}
                aria-hidden="true"
              />
              {group.label}
              <span>{group.tabIds.length}</span>
            </button>
          ))}
        </section>
      ) : null}

      {bulkMode ? (
        <section className="tab-bulk-dialog" aria-label="Bulk close tabs">
          <div className="tab-management-heading">
            <strong>
              {bulkMode === 'containing'
                ? 'Close tabs containing text'
                : 'Close tabs not containing text'}
            </strong>
            <button
              type="button"
              className="icon-button"
              onClick={() => setBulkMode(null)}
              aria-label="Close bulk action"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <SearchWorkbench
            surfaceId="tab-bulk-close-search"
            label="Search titles for bulk close"
            placeholder="Type text or open the regular-expression builder"
            records={allRecords}
            onActivate={() => undefined}
            compact
            onMatchSummaryChange={onBulkSummaryChange}
          />
          <p>
            {!bulkSummary.query.trim()
              ? 'Enter text before closing tabs.'
              : bulkSummary.invalid
                ? 'The regular expression is invalid. No tabs can close.'
                : `${bulkMatches.length} tabs match. ${bulkMatches.filter((record) => protectedIds.has(record.id)).length} pinned tabs stay protected by default.`}
          </p>
          <ul className="tab-bulk-preview">
            {bulkMatches.map((record) => (
              <li key={record.id}>
                {record.title}
                {protectedIds.has(record.id) ? ' (pinned, protected)' : ''}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={
              !bulkSummary.query.trim() ||
              bulkSummary.invalid ||
              !bulkMatches.some((record) => !protectedIds.has(record.id))
            }
            onClick={closeBulk}
          >
            Close unpinned matches
          </button>
        </section>
      ) : null}
    </nav>
  );
}
