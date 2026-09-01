import assert from 'node:assert/strict';
import test from 'node:test';

import { classifySourceResponse } from '../scripts/import-fandom.mjs';

void test('classifies a terms challenge separately from other forbidden responses', () => {
  assert.equal(
    classifySourceResponse({
      url: 'https://www.fandom.com/terms-of-use',
      purpose: 'terms-of-use',
      status: 403,
      contentType: 'text/html; charset=UTF-8',
      text: 'Just a moment... enable JavaScript and cookies to continue',
    }),
    'TERMS_CHALLENGE',
  );
  assert.equal(
    classifySourceResponse({
      url: 'https://enlossengas.fandom.com/api.php',
      purpose: 'MediaWiki API query',
      status: 403,
      contentType: 'application/json',
      text: '{"error":{"code":"permissiondenied"}}',
    }),
    'SOURCE_FORBIDDEN',
  );
  assert.equal(
    classifySourceResponse({
      url: 'https://www.fandom.com/terms-of-use',
      purpose: 'terms-of-use',
      status: 200,
      contentType: 'text/html; charset=UTF-8',
      text: '<main>Terms of Use</main>',
    }),
    null,
  );
});

void test('classifies retryable, ordinary HTTP, and successful responses', () => {
  assert.equal(
    classifySourceResponse({
      status: 503,
      contentType: 'application/json',
      text: '{}',
    }),
    'SOURCE_RETRYABLE:503',
  );
  assert.equal(
    classifySourceResponse({
      status: 404,
      contentType: 'application/json',
      text: '{}',
    }),
    'SOURCE_HTTP:404',
  );
  assert.equal(
    classifySourceResponse({
      status: 200,
      contentType: 'application/json',
      text: '{}',
    }),
    null,
  );
});
