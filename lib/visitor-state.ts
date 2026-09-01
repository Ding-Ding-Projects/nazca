import { z } from 'zod';

export type LanguageMode = 'en' | 'zh-HK' | 'bilingual';

const scheduleSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
    enabled: z.boolean(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    languageMode: z.enum(['en', 'zh-HK', 'bilingual']).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  })
  .strict();

export const visitorSettingsSchema = z
  .object({
    languageMode: z.enum(['en', 'zh-HK', 'bilingual']),
    funnyLevelEnglish: z.number().int().min(1).max(5),
    funnyLevelCantonese: z.number().int().min(1).max(5),
    showDialogEmojis: z.boolean(),
    theme: z.enum(['light', 'dark', 'system']),
    density: z.enum(['comfortable', 'compact']),
    seedColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    displayName: z.string().min(1).max(80).nullable(),
    schoolMode: z
      .object({
        enabled: z.boolean(),
        displayName: z.string().min(1).max(80),
      })
      .strict(),
    narrator: z
      .object({
        enabled: z.boolean(),
        language: z.enum(['en', 'zh-HK', 'both']),
        englishVoiceId: z.string().max(512),
        cantoneseVoiceId: z.string().max(512),
        rate: z.number().min(0.5).max(2),
        pitch: z.number().min(0).max(2),
      })
      .strict(),
    attention: z
      .object({
        focus: z.boolean(),
        lowStimulation: z.boolean(),
        timeAwareness: z.boolean(),
        oneThingAtATime: z.boolean(),
        momentum: z.boolean(),
        nextAction: z.string().max(240).nullable(),
        momentumSnoozedUntil: z.iso.datetime({ offset: true }).nullable(),
      })
      .strict(),
    schedules: z.array(scheduleSchema).max(128),
  })
  .strict();

export const visitorStateSchema = z
  .object({
    recordType: z.literal('VisitorStateV1'),
    schemaVersion: z.literal('1.0.0'),
    revision: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime({ offset: true }),
    settings: visitorSettingsSchema,
  })
  .strict();

export type VisitorSettings = z.infer<typeof visitorSettingsSchema>;
export type VisitorState = z.infer<typeof visitorStateSchema>;
export type ScheduleRule = z.infer<typeof scheduleSchema>;

export const defaultVisitorState: VisitorState = {
  recordType: 'VisitorStateV1',
  schemaVersion: '1.0.0',
  revision: 0,
  updatedAt: '2026-08-31T00:00:00.000Z',
  settings: {
    languageMode: 'en',
    funnyLevelEnglish: 5,
    funnyLevelCantonese: 5,
    showDialogEmojis: true,
    theme: 'system',
    density: 'comfortable',
    seedColor: '#116c79',
    displayName: null,
    schoolMode: { enabled: false, displayName: 'School mode' },
    narrator: {
      enabled: false,
      language: 'en',
      englishVoiceId: 'auto',
      cantoneseVoiceId: 'auto',
      rate: 1,
      pitch: 1,
    },
    attention: {
      focus: false,
      lowStimulation: false,
      timeAwareness: false,
      oneThingAtATime: false,
      momentum: false,
      nextAction: null,
      momentumSnoozedUntil: null,
    },
    schedules: [],
  },
};

export type VocabularyEntry = { from: string; to: string };
export type NotificationRecord = {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  createdAt: string;
  dismissed: boolean;
};
export type HistoryRecord = {
  id: string;
  sequence: number;
  action: string;
  target: string;
  timestamp: string;
  summary: string;
};
const vocabularySchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    entries: z
      .array(
        z
          .object({
            from: z.string().min(1).max(256),
            to: z.string().min(1).max(256),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();

const DATABASE = 'nazca-visitor-v1';
const DATABASE_VERSION = 1;
const STATE_STORE = 'state';
const PRIVATE_STORE = 'private';
const STATE_KEY = 'visitor';

export function openVisitorDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE))
        database.createObjectStore(STATE_STORE);
      if (!database.objectStoreNames.contains(PRIVATE_STORE))
        database.createObjectStore(PRIVATE_STORE);
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
}

function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openVisitorDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const request = operation(transaction.objectStore(storeName));
        request.addEventListener('success', () => resolve(request.result));
        request.addEventListener('error', () => reject(request.error));
        transaction.addEventListener('complete', () => database.close());
        transaction.addEventListener('abort', () => reject(transaction.error));
      }),
  );
}

export async function loadVisitorState() {
  const raw = await transact<unknown>(STATE_STORE, 'readonly', (store) =>
    store.get(STATE_KEY),
  );
  if (raw === undefined) return defaultVisitorState;
  return visitorStateSchema.parse(raw);
}

export function saveVisitorState(state: VisitorState) {
  const validated = visitorStateSchema.parse(state);
  return transact<IDBValidKey>(STATE_STORE, 'readwrite', (store) =>
    store.put(validated, STATE_KEY),
  );
}

export async function parseVocabularyFile(file: File) {
  if (file.size > 256 * 1024)
    throw new Error('The vocabulary file exceeds the 256 KiB limit.');
  const parsed = vocabularySchema.parse(JSON.parse(await file.text()));
  const seen = new Set<string>();
  for (const entry of parsed.entries) {
    if (['__proto__', 'constructor', 'prototype'].includes(entry.from)) {
      throw new Error('The vocabulary file contains an unsafe key.');
    }
    if (seen.has(entry.from))
      throw new Error(`Duplicate vocabulary key: ${entry.from}`);
    seen.add(entry.from);
  }
  return parsed.entries;
}

export function saveVocabulary(entries: VocabularyEntry[]) {
  return transact<IDBValidKey>(PRIVATE_STORE, 'readwrite', (store) =>
    store.put(entries, 'vocabulary'),
  );
}

export async function loadVocabulary() {
  const raw = await transact<unknown>(PRIVATE_STORE, 'readonly', (store) =>
    store.get('vocabulary'),
  );
  if (!Array.isArray(raw)) return [];
  return vocabularySchema.shape.entries.parse(raw);
}

export function clearVocabulary() {
  return transact<undefined>(PRIVATE_STORE, 'readwrite', (store) =>
    store.delete('vocabulary'),
  );
}

export function loadPrivateValue<T>(key: string) {
  return transact<T | undefined>(PRIVATE_STORE, 'readonly', (store) =>
    store.get(key),
  );
}

export function savePrivateValue<T>(key: string, value: T) {
  return transact<IDBValidKey>(PRIVATE_STORE, 'readwrite', (store) =>
    store.put(value, key),
  );
}

export function deletePrivateValue(key: string) {
  return transact<undefined>(PRIVATE_STORE, 'readwrite', (store) =>
    store.delete(key),
  );
}

const notificationArraySchema = z
  .array(
    z
      .object({
        id: z.uuid(),
        kind: z.enum(['info', 'success', 'warning', 'error']),
        title: z.string().min(1).max(160),
        body: z.string().max(2048),
        createdAt: z.iso.datetime({ offset: true }),
        dismissed: z.boolean(),
      })
      .strict(),
  )
  .max(10_000);

const historyArraySchema = z
  .array(
    z
      .object({
        id: z.uuid(),
        sequence: z.number().int().nonnegative(),
        action: z.string().min(1).max(160),
        target: z.string().min(1).max(240),
        timestamp: z.iso.datetime({ offset: true }),
        summary: z.string().max(2048),
      })
      .strict(),
  )
  .max(20_000);

export async function loadNotifications() {
  const raw = await transact<unknown>(STATE_STORE, 'readonly', (store) =>
    store.get('notifications'),
  );
  return raw === undefined ? [] : notificationArraySchema.parse(raw);
}

export function saveNotifications(records: NotificationRecord[]) {
  return transact<IDBValidKey>(STATE_STORE, 'readwrite', (store) =>
    store.put(notificationArraySchema.parse(records), 'notifications'),
  );
}

export async function loadHistory() {
  const raw = await transact<unknown>(STATE_STORE, 'readonly', (store) =>
    store.get('history'),
  );
  return raw === undefined ? [] : historyArraySchema.parse(raw);
}

export function saveHistory(records: HistoryRecord[]) {
  return transact<IDBValidKey>(STATE_STORE, 'readwrite', (store) =>
    store.put(historyArraySchema.parse(records), 'history'),
  );
}

async function deriveCredential(secret: string, salt: Uint8Array) {
  const safeSalt = new Uint8Array(salt.byteLength);
  safeSalt.set(salt);
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: safeSalt, iterations: 150_000 },
      material,
      256,
    ),
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function setSchoolCredential(secret: string) {
  if (secret.length < 4 || secret.length > 128)
    throw new Error('Use 4 to 128 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveCredential(secret, salt);
  return transact<IDBValidKey>(PRIVATE_STORE, 'readwrite', (store) =>
    store.put(
      { salt: bytesToBase64(salt), hash: bytesToBase64(hash) },
      'school-credential',
    ),
  );
}

export async function hasSchoolCredential() {
  return !!(await transact<unknown>(PRIVATE_STORE, 'readonly', (store) =>
    store.get('school-credential'),
  ));
}

export async function verifySchoolCredential(secret: string) {
  const record = await transact<{ salt: string; hash: string } | undefined>(
    PRIVATE_STORE,
    'readonly',
    (store) => store.get('school-credential'),
  );
  if (!record) return false;
  const actual = await deriveCredential(secret, base64ToBytes(record.salt));
  const expected = base64ToBytes(record.hash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1)
    difference |= actual[index] ^ expected[index];
  return difference === 0;
}
