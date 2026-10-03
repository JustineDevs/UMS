#!/usr/bin/env node

/**
 * Verify that public health endpoints expose the current liveness/readiness
 * contract. This is intentionally an opt-in live check; release-gate remains
 * network-independent so a provider outage cannot hide a source regression.
 */

const DEFAULTS = {
  workerPreview: 'https://ums-backend-preview.pcg0255.workers.dev',
  workerProduction: 'https://ums-backend-production.pcg0255.workers.dev',
  storefrontProduction: 'https://universalmusic.vercel.app',
};

function normalizeBaseUrl(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function validateWorkerReadiness(payload, status, url) {
  const failures = [];
  if (status !== 200) failures.push(`${url} returned HTTP ${status}`);
  if (payload?.status !== 'ok') failures.push(`${url} status is not ok`);
  if (payload?.databaseRoles?.app !== true) failures.push(`${url} app database is not ready`);
  if (payload?.databaseRoles?.medusa !== true) failures.push(`${url} Medusa database is not ready`);
  return failures;
}

export function validateStorefrontSop(payload, status, url) {
  const failures = [];
  if (status !== 200) failures.push(`${url} returned HTTP ${status}`);
  if (payload?.status !== 'ok') failures.push(`${url} status is not ok`);
  if (payload?.worker?.readyReachable !== true) {
    failures.push(`${url} does not expose worker.readyReachable=true`);
  }
  if (!payload?.deployment?.commitSha || payload.deployment.commitSha === 'unknown') {
    failures.push(`${url} does not expose a deployed commit SHA`);
  }
  if (Object.hasOwn(payload?.worker ?? {}, 'healthReachable')) {
    failures.push(`${url} still exposes the retired worker.healthReachable field`);
  }
  return failures;
}

async function getJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  return { payload, status: response.status };
}

async function checkWorker(baseUrl, fetchImpl) {
  const url = `${normalizeBaseUrl(baseUrl)}/readyz`;
  const result = await getJson(url, fetchImpl);
  return validateWorkerReadiness(result.payload, result.status, url);
}

async function checkStorefront(baseUrl, fetchImpl) {
  const url = `${normalizeBaseUrl(baseUrl)}/api/health/sop`;
  const result = await getJson(url, fetchImpl);
  return validateStorefrontSop(result.payload, result.status, url);
}

export async function runChecks({
  workerPreview = process.env.PUBLIC_WORKER_URL_PREVIEW ?? DEFAULTS.workerPreview,
  workerProduction = process.env.PUBLIC_WORKER_URL_PRODUCTION ?? DEFAULTS.workerProduction,
  storefrontProduction = process.env.STOREFRONT_URL_PRODUCTION ?? DEFAULTS.storefrontProduction,
  fetchImpl = fetch,
} = {}) {
  const failures = [];
  for (const baseUrl of [workerPreview, workerProduction]) {
    try {
      failures.push(...await checkWorker(baseUrl, fetchImpl));
    } catch (error) {
      failures.push(`${baseUrl}/readyz request failed: ${error.message}`);
    }
  }
  try {
    failures.push(...await checkStorefront(storefrontProduction, fetchImpl));
  } catch (error) {
    failures.push(`${storefrontProduction}/api/health/sop request failed: ${error.message}`);
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = await runChecks();
  if (failures.length > 0) {
    console.error('Deployed health contract check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Deployed health contract check passed.');
  }
}
