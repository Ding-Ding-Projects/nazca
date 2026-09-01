import { loadPrivateValue, savePrivateValue } from './visitor-state.ts';

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';
export type TotpEntry = {
  id: string;
  issuer: string;
  account: string;
  secret: string;
  algorithm: TotpAlgorithm;
  digits: 6 | 7 | 8;
  period: number;
};

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/[\s=-]/g, '');
  if (!normalized || /[^A-Z2-7]/.test(normalized))
    throw new Error('Secret is not valid Base32.');
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];
  for (const character of normalized) {
    buffer = (buffer << 5) | BASE32.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(output);
}

export function encodeBase32(bytes: Uint8Array) {
  let bits = 0;
  let buffer = 0;
  let output = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) output += BASE32[(buffer << (5 - bits)) & 31];
  return output;
}

function counterBytes(counter: number) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, Math.floor(counter / 0x1_0000_0000), false);
  view.setUint32(4, counter >>> 0, false);
  return bytes;
}

export async function generateTotp(entry: TotpEntry, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / entry.period);
  const key = await crypto.subtle.importKey(
    'raw',
    decodeBase32(entry.secret),
    { name: 'HMAC', hash: entry.algorithm },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, counterBytes(counter)),
  );
  const offset = digest.at(-1)! & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** entry.digits).padStart(entry.digits, '0');
}

export function parseOtpAuthUri(value: string): TotpEntry {
  const url = new URL(value);
  if (url.protocol !== 'otpauth:' || url.hostname !== 'totp')
    throw new Error('Use a standard otpauth://totp/ URI.');
  const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const separator = label.indexOf(':');
  const issuer =
    url.searchParams.get('issuer') ||
    (separator >= 0 ? label.slice(0, separator) : 'Local account');
  const account = separator >= 0 ? label.slice(separator + 1) : label;
  const secret = url.searchParams.get('secret') || '';
  decodeBase32(secret);
  const algorithm = (url.searchParams.get('algorithm') || 'SHA1')
    .toUpperCase()
    .replace('SHA', 'SHA-') as TotpAlgorithm;
  if (!['SHA-1', 'SHA-256', 'SHA-512'].includes(algorithm))
    throw new Error(`Unsupported TOTP algorithm: ${algorithm}`);
  const digits = Number(url.searchParams.get('digits') || 6);
  if (![6, 7, 8].includes(digits))
    throw new Error('TOTP digits must be 6, 7, or 8.');
  const period = Number(url.searchParams.get('period') || 30);
  if (!Number.isInteger(period) || period < 5 || period > 300)
    throw new Error('TOTP period must be 5 to 300 seconds.');
  return {
    id: crypto.randomUUID(),
    issuer,
    account,
    secret,
    algorithm,
    digits: digits as 6 | 7 | 8,
    period,
  };
}

export function toOtpAuthUri(entry: TotpEntry) {
  const label = encodeURIComponent(`${entry.issuer}:${entry.account}`);
  const params = new URLSearchParams({
    secret: entry.secret.replace(/[\s-]/g, '').toUpperCase(),
    issuer: entry.issuer,
    algorithm: entry.algorithm.replace('-', ''),
    digits: String(entry.digits),
    period: String(entry.period),
  });
  return `otpauth://totp/${label}?${params}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function getVaultKey() {
  const stored = await loadPrivateValue<CryptoKey>('totp-vault-key');
  if (stored) return stored;
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  await savePrivateValue('totp-vault-key', key);
  return key;
}

export async function saveTotpEntries(entries: TotpEntry[]) {
  const key = await getVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(entries));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  await savePrivateValue('totp-entries', {
    schemaVersion: '1.0.0',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  });
}

export async function loadTotpEntries() {
  const record = await loadPrivateValue<{
    schemaVersion: string;
    iv: string;
    ciphertext: string;
  }>('totp-entries');
  if (!record) return [];
  const key = await getVaultKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(record.iv) },
    key,
    base64ToBytes(record.ciphertext),
  );
  const entries = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Array.isArray(entries) || entries.length > 2000)
    throw new Error('Authenticator storage is invalid.');
  return entries as TotpEntry[];
}
