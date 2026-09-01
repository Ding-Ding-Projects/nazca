import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeBase32,
  encodeBase32,
  generateTotp,
  parseOtpAuthUri,
} from '../lib/totp.ts';

const vectors = [
  [59, '94287082', '46119246', '90693936'],
  [1_111_111_109, '07081804', '68084774', '25091201'],
  [1_111_111_111, '14050471', '67062674', '99943326'],
  [1_234_567_890, '89005924', '91819424', '93441116'],
  [2_000_000_000, '69279037', '90698825', '38618901'],
  [20_000_000_000, '65353130', '77737706', '47863826'],
];

const secrets = {
  'SHA-1': '12345678901234567890',
  'SHA-256': '12345678901234567890123456789012',
  'SHA-512': '1234567890123456789012345678901234567890123456789012345678901234',
};

test('Base32 encoding and decoding round trip', () => {
  const bytes = new TextEncoder().encode('Nazca Railway');
  assert.deepEqual(decodeBase32(encodeBase32(bytes)), bytes);
});

test('matches the RFC 6238 SHA-1, SHA-256, and SHA-512 vectors', async () => {
  for (const [seconds, sha1, sha256, sha512] of vectors) {
    for (const [algorithm, expected] of [
      ['SHA-1', sha1],
      ['SHA-256', sha256],
      ['SHA-512', sha512],
    ]) {
      const actual = await generateTotp(
        {
          id: 'vector',
          issuer: 'RFC',
          account: 'test',
          secret: encodeBase32(new TextEncoder().encode(secrets[algorithm])),
          algorithm,
          digits: 8,
          period: 30,
        },
        seconds * 1000,
      );
      assert.equal(actual, expected, `${algorithm} at ${seconds}`);
    }
  }
});

test('parses standard otpauth parameters without replacing them', () => {
  const entry = parseOtpAuthUri(
    'otpauth://totp/Nazca%3Areader?secret=GEZDGNBVGY3TQOJQ&issuer=Nazca&algorithm=SHA256&digits=8&period=45',
  );
  assert.equal(entry.issuer, 'Nazca');
  assert.equal(entry.account, 'reader');
  assert.equal(entry.algorithm, 'SHA-256');
  assert.equal(entry.digits, 8);
  assert.equal(entry.period, 45);
});

test('rejects malformed secrets, algorithms, digits, and periods', () => {
  assert.throws(() => parseOtpAuthUri('https://example.com'), /otpauth/);
  assert.throws(
    () => parseOtpAuthUri('otpauth://totp/a?secret=BAD!'),
    /Base32/,
  );
  assert.throws(
    () => parseOtpAuthUri('otpauth://totp/a?secret=GEZDGNBV&algorithm=MD5'),
    /algorithm/,
  );
  assert.throws(
    () => parseOtpAuthUri('otpauth://totp/a?secret=GEZDGNBV&digits=9'),
    /digits/,
  );
  assert.throws(
    () => parseOtpAuthUri('otpauth://totp/a?secret=GEZDGNBV&period=1'),
    /period/,
  );
});
