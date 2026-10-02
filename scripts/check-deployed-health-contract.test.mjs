import test from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, validateStorefrontSop, validateWorkerReadiness } from './check-deployed-health-contract.mjs';

test('worker readiness requires both database roles', () => {
  assert.deepEqual(
    validateWorkerReadiness({ status: 'ok', databaseRoles: { app: true, medusa: true } }, 200, 'https://worker/readyz'),
    [],
  );
  assert.match(
    validateWorkerReadiness({ status: 'ok', databaseRoles: { app: true, medusa: false } }, 200, 'https://worker/readyz').join('\n'),
    /Medusa database is not ready/,
  );
});

test('storefront readiness rejects the retired healthReachable contract', () => {
  assert.match(
    validateStorefrontSop({ status: 'ok', worker: { healthReachable: true } }, 200, 'https://storefront/api/health/sop').join('\n'),
    /readyReachable|retired/,
  );
});

test('live check reports endpoint contract failures without requiring real network access', async () => {
  const responses = new Map([
    ['https://preview/readyz', { status: 200, body: { status: 'ok', databaseRoles: { app: true, medusa: true } } }],
    ['https://production/readyz', { status: 200, body: { status: 'ok', databaseRoles: { app: true, medusa: true } } }],
    ['https://storefront/api/health/sop', { status: 200, body: { status: 'ok', worker: { healthReachable: true } } }],
  ]);
  const failures = await runChecks({
    workerPreview: 'https://preview',
    workerProduction: 'https://production',
    storefrontProduction: 'https://storefront',
    fetchImpl: async (url) => {
      const response = responses.get(url);
      return { status: response.status, json: async () => response.body };
    },
  });
  assert.ok(failures.some((failure) => failure.includes('retired worker.healthReachable')));
});
