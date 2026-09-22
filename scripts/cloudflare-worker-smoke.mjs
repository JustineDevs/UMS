#!/usr/bin/env node
/**
 * Read-only deployment smoke checks for the Worker topology.
 *
 * Override UVS_WORKER_SMOKE_URLS with a comma-separated list when checking a
 * different preview environment. No mutation route is called by this script.
 */
const defaultUrls = [
  "https://ums-backend-preview.pcg0255.workers.dev",
  "https://ums-backend-production.pcg0255.workers.dev",
];

const urls = (process.env.UVS_WORKER_SMOKE_URLS ?? defaultUrls.join(","))
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (urls.length === 0) {
  console.error("UVS_WORKER_SMOKE_URLS must contain at least one HTTPS Worker URL");
  process.exit(2);
}

function assertHttps(base) {
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error(`Worker smoke URL must use HTTPS: ${base}`);
  return url.origin;
}

async function check(base, path, expectedStatus, validate) {
  const url = `${base}${path}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    // The error below includes a bounded response excerpt for diagnosis.
  }
  if (response.status !== expectedStatus) {
    throw new Error(`${url} expected ${expectedStatus}, received ${response.status}: ${text.slice(0, 240)}`);
  }
  if (validate) validate(payload);
  return { path, status: response.status };
}

function objectPayload(payload, label) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${label} returned a non-object JSON payload`);
  }
  return payload;
}

async function smoke(base) {
  const checks = [
    ["/healthz", 200, (payload) => {
      const value = objectPayload(payload, "/healthz");
      if (value.runtime !== "cloudflare_worker") throw new Error("/healthz is not Worker-native");
    }],
    ["/readyz", 200, (payload) => {
      const value = objectPayload(payload, "/readyz");
      if (value.databaseRoles?.app !== true || value.databaseRoles?.medusa !== true) {
        throw new Error("/readyz did not prove both database roles are ready");
      }
    }],
    ["/store/products?limit=1", 200, (payload) => {
      const value = objectPayload(payload, "/store/products");
      if (!Array.isArray(value.products)) throw new Error("/store/products did not return products[]");
    }],
    ["/api/admin/orders", 401, (payload) => {
      const value = objectPayload(payload, "/api/admin/orders");
      if (typeof value.error !== "string") throw new Error("unauthenticated admin response lacked an error");
    }],
  ];
  const results = [];
  const failures = [];
  for (const [path, expectedStatus, validate] of checks) {
    try {
      results.push(await check(base, path, expectedStatus, validate));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length > 0) throw new Error(failures.join("; "));
  return results;
}

const results = [];
for (const rawUrl of urls) {
  const base = assertHttps(rawUrl);
  try {
    const checks = await smoke(base);
    results.push({ base, checks });
    console.log(`PASS ${base}: ${checks.map(({ path, status }) => `${path}=${status}`).join(", ")}`);
  } catch (error) {
    console.error(`FAIL ${base}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv.includes("--json")) console.log(JSON.stringify(results, null, 2));
