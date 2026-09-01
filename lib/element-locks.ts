import { decodeBase32, generateTotp } from './totp.ts';
import { loadPrivateValue, savePrivateValue } from './visitor-state.ts';

export type LockPolicy =
  | 'pin'
  | 'password'
  | 'pin-password'
  | 'password-totp'
  | 'pin-totp'
  | 'password-pin-totp';

type SecretHash = { salt: string; hash: string };
export type ElementLock = {
  id: string;
  targetId: string;
  label: string;
  policy: LockPolicy;
  pin?: SecretHash;
  password?: SecretHash;
  totpSecret?: string;
  createdAt: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function derive(secret: string, salt: Uint8Array) {
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

async function createHash(secret: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: bytesToBase64(salt),
    hash: bytesToBase64(await derive(secret, salt)),
  };
}

async function verifyHash(secret: string, record: SecretHash | undefined) {
  if (!record) return false;
  const actual = await derive(secret, base64ToBytes(record.salt));
  const expected = base64ToBytes(record.hash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1)
    difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export function policyNeeds(
  policy: LockPolicy,
  factor: 'pin' | 'password' | 'totp',
) {
  return policy.split('-').includes(factor);
}

export async function createElementLock({
  targetId,
  label,
  policy,
  pin,
  password,
  totpSecret,
}: {
  targetId: string;
  label: string;
  policy: LockPolicy;
  pin?: string;
  password?: string;
  totpSecret?: string;
}): Promise<ElementLock> {
  if (
    policyNeeds(policy, 'pin') &&
    (!pin || pin.length < 4 || pin.length > 32)
  ) {
    throw new Error('A required PIN must contain 4 to 32 characters.');
  }
  if (
    policyNeeds(policy, 'password') &&
    (!password || password.length < 4 || password.length > 128)
  ) {
    throw new Error('A required password must contain 4 to 128 characters.');
  }
  if (policyNeeds(policy, 'totp') && !totpSecret) {
    throw new Error('A required TOTP secret is missing.');
  }
  if (policyNeeds(policy, 'totp')) decodeBase32(totpSecret ?? '');
  return {
    id: crypto.randomUUID(),
    targetId,
    label: label.slice(0, 240),
    policy,
    ...(pin ? { pin: await createHash(pin) } : {}),
    ...(password ? { password: await createHash(password) } : {}),
    ...(totpSecret
      ? { totpSecret: totpSecret.replace(/[\s-]/g, '').toUpperCase() }
      : {}),
    createdAt: new Date().toISOString(),
  };
}

export async function verifyElementLock(
  lock: ElementLock,
  answers: { pin?: string; password?: string; totp?: string },
  timestamp = Date.now(),
) {
  if (
    policyNeeds(lock.policy, 'pin') &&
    !(await verifyHash(answers.pin ?? '', lock.pin))
  )
    return false;
  if (
    policyNeeds(lock.policy, 'password') &&
    !(await verifyHash(answers.password ?? '', lock.password))
  )
    return false;
  if (policyNeeds(lock.policy, 'totp')) {
    const expected = await generateTotp(
      {
        id: lock.id,
        issuer: 'Nazca Railway',
        account: lock.label,
        secret: lock.totpSecret ?? '',
        algorithm: 'SHA-1',
        digits: 6,
        period: 30,
      },
      timestamp,
    );
    if (answers.totp !== expected) return false;
  }
  return true;
}

async function getVaultKey() {
  const stored = await loadPrivateValue<CryptoKey>('element-lock-vault-key');
  if (stored) return stored;
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  await savePrivateValue('element-lock-vault-key', key);
  return key;
}

export async function saveElementLocks(locks: ElementLock[]) {
  const key = await getVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(locks)),
    ),
  );
  await savePrivateValue('element-locks', {
    schemaVersion: '1.0.0',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  });
}

export async function loadElementLocks() {
  const record = await loadPrivateValue<{
    schemaVersion: string;
    iv: string;
    ciphertext: string;
  }>('element-locks');
  if (!record) return [];
  const key = await getVaultKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(record.iv) },
    key,
    base64ToBytes(record.ciphertext),
  );
  const parsed = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Array.isArray(parsed) || parsed.length > 10_000)
    throw new Error('Element lock storage is invalid.');
  return parsed as ElementLock[];
}
