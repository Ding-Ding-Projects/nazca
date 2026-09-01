import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createElementLock,
  policyNeeds,
  verifyElementLock,
} from '../lib/element-locks.ts';
import { encodeBase32, generateTotp } from '../lib/totp.ts';

const policies = [
  'pin',
  'password',
  'pin-password',
  'password-totp',
  'pin-totp',
  'password-pin-totp',
];
const timestamp = 1_700_000_000_000;
const secret = encodeBase32(new TextEncoder().encode('12345678901234567890'));

test('each policy reports the exact required factors', () => {
  assert.equal(policyNeeds('pin', 'pin'), true);
  assert.equal(policyNeeds('pin', 'password'), false);
  assert.equal(policyNeeds('password-pin-totp', 'totp'), true);
});

test('all six lock policies accept correct factors and reject wrong factors', async () => {
  for (const policy of policies) {
    const lock = await createElementLock({
      targetId: `target-${policy}`,
      label: policy,
      policy,
      pin: policyNeeds(policy, 'pin') ? '2468' : undefined,
      password: policyNeeds(policy, 'password') ? 'railway-pass' : undefined,
      totpSecret: policyNeeds(policy, 'totp') ? secret : undefined,
    });
    const totp = policyNeeds(policy, 'totp')
      ? await generateTotp(
          {
            id: lock.id,
            issuer: 'Nazca Railway',
            account: lock.label,
            secret,
            algorithm: 'SHA-1',
            digits: 6,
            period: 30,
          },
          timestamp,
        )
      : undefined;
    assert.equal(
      await verifyElementLock(
        lock,
        { pin: '2468', password: 'railway-pass', totp },
        timestamp,
      ),
      true,
      policy,
    );
    assert.equal(
      await verifyElementLock(
        lock,
        { pin: '0000', password: 'wrong', totp: '000000' },
        timestamp,
      ),
      false,
      policy,
    );
  }
});

test('missing required factors and invalid TOTP secrets are rejected', async () => {
  await assert.rejects(
    createElementLock({ targetId: 'a', label: 'A', policy: 'pin' }),
    /required PIN/,
  );
  await assert.rejects(
    createElementLock({
      targetId: 'b',
      label: 'B',
      policy: 'password-totp',
      password: 'valid-password',
      totpSecret: 'BAD!',
    }),
    /Base32/,
  );
});
