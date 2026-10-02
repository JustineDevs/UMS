import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIVATE_PAGE_CONTRACT, runChecks, validatePrivatePageResponse } from './check-deployed-private-page-contract.mjs';

test('private-page contract requires no-store and no-referrer', () => {
  const failures = validatePrivatePageResponse({
  status: 307,
    headers: new Headers({
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'strict-transport-security': 'max-age=63072000',
      'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
      'permissions-policy': 'camera=()',
    }),
    body: '',
  }, PRIVATE_PAGE_CONTRACT[0], 'https://store/account/profile');
  assert.deepEqual(failures, []);
});

test('public token pages require noindex metadata', () => {
  const failures = validatePrivatePageResponse({
    status: 200,
    headers: new Headers({
      'cache-control': 'private, no-cache, no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'strict-transport-security': 'max-age=63072000',
      'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
      'permissions-policy': 'camera=()',
    }),
    body: '<meta name="robots" content="noindex,nofollow">',
  }, PRIVATE_PAGE_CONTRACT.find((route) => route.path === '/track'), 'https://store/track');
  assert.deepEqual(failures, []);
});

test('live check reports missing privacy headers for every route', async () => {
  const failures = await runChecks({
    baseUrl: 'https://store',
    fetchImpl: async () => ({
      status: 200,
      headers: new Headers(),
      text: async () => '',
    }),
  });
  assert.equal(failures.length, PRIVATE_PAGE_CONTRACT.length * 6 + 3);
});
