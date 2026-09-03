export type ChangelogEntry = {
  version: string;
  date: string;
  category:
    | 'Foundation'
    | 'Reader'
    | 'Operations'
    | 'Search'
    | 'Settings'
    | 'Tools';
  title: string;
  summary: string;
  commit: string;
};

export const releaseCodeName = {
  en: 'Classic Har Gow',
  zhHant: '蝦餃',
  assetUrl:
    'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/hk-dish-0001-classic-har-gow.png',
  releaseUrl:
    'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/tag/catalog-v1',
};

export const changelogEntries: ChangelogEntry[] = [
  {
    version: '0.1.0-dev.1',
    date: '2026-08-31T20:42:47-04:00',
    category: 'Foundation',
    title: 'Initial transit-atlas shell',
    summary:
      'Created the public repository, Sites scaffold, modern reader shell, source status rail, and first search preview.',
    commit: '9afde9d62a8df278d589f633be3592ec649b0a7a',
  },
  {
    version: '0.1.0-dev.2',
    date: '2026-08-31T21:58:00-04:00',
    category: 'Reader',
    title: 'First corpus-aware article reader',
    summary:
      'Added the concrete Nazca Railway route, importer policy boundary, typed records, attribution, static export, provenance, and social metadata.',
    commit: 'a847c731c289cd510c2e6c9c204f84e0e38e082b',
  },
  {
    version: '0.1.0-dev.3',
    date: '2026-08-31T22:20:35-04:00',
    category: 'Operations',
    title: 'Documentation and build bootstrap',
    summary:
      'Added the public guide, roadmap, handoff, inventories, negative checks, pinned Node acquisition, and offline bundle.',
    commit: 'a6b95428167ccf2471de6719db58f00eae0906fc',
  },
  {
    version: '0.1.0-dev.4',
    date: '2026-08-31T22:45:25-04:00',
    category: 'Search',
    title: 'Bounded RE2/WASM workbench',
    summary:
      'Unified search fields behind an isolated worker with dialect limits, captures, replacement preview, timing, and exact WASM delivery.',
    commit: '1053bf92b3bc0dd6595065268281598cc5009404',
  },
  {
    version: '0.1.0-dev.5',
    date: '2026-08-31T23:09:59-04:00',
    category: 'Settings',
    title: 'Persistent localized visitor settings',
    summary:
      'Added strict IndexedDB settings, localization controls, personal vocabulary, School mode, voices, schedules, appearance, and attention modes.',
    commit: '177e42e071126c2fe1272d74ba097c93f3cc1dbf',
  },
  {
    version: '0.1.0-dev.6',
    date: '2026-08-31T23:28:34-04:00',
    category: 'Tools',
    title: 'Encrypted local tools and command routing',
    summary:
      'Added the command palette, notifications, redacted history, authenticator, converter, loopback model checks, exports, and offline help.',
    commit: 'f5df08d90be60f1b6014ec6a2258ffec81cbe3d1',
  },
  {
    version: '0.1.0-dev.7',
    date: '2026-09-02T19:00:52-04:00',
    category: 'Reader',
    title: 'Exact-revision rendered reader corpus',
    summary:
      'Compiled 3,422 current article records from exact-revision rendered HTML with semantic tables, safe links, and deferred media metadata.',
    commit: 'b10334bd5c8d4d312a65ca5c14f26ba2ff09a237',
  },
  {
    version: '0.1.0-dev.8',
    date: '2026-09-02T19:01:07-04:00',
    category: 'Reader',
    title: 'Truthful atlas destinations',
    summary:
      'Made each left navigation destination render its own truthful surface, with generated article records opening their exact reader routes.',
    commit: '99f6ce6ed6eb45c223fd97cdbddefd9e793bea82',
  },
  {
    version: '0.1.0-dev.9',
    date: '2026-09-02T19:44:53-04:00',
    category: 'Foundation',
    title: 'Selected Reader 1b design direction',
    summary:
      'Integrated the selected reader design direction into the production shell, article reader, and global styling paths, with the committed handoff archive preserved.',
    commit: '6e23d907c331dff8d37299c19b742931c3eb12ba',
  },
  {
    version: '0.1.0-dev.10',
    date: '2026-09-02T20:39:35-04:00',
    category: 'Reader',
    title: 'Rebuilt the home atlas composition',
    summary:
      'Replaced the unchanged home overview with the Reader 1b hero, destination cards, useful-record list, corpus evidence, and responsive network and provenance rail.',
    commit: 'c0f8aafcae2baf94c879ea746c349a3b92a9a75d',
  },
  {
    version: '0.1.1-dev.1',
    date: '2026-09-02T21:19:07-04:00',
    category: 'Reader',
    title: 'Completed Reader 1b state compositions',
    summary:
      'Added corpus-backed station and year presentations, full destination and dedicated search states, shared redirect and not-found recovery surfaces, and responsive phone bottom navigation.',
    commit: '835764c9fe0db7872472c88724fb42b95c7bad6c',
  },
];
