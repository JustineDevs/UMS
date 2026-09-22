import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCatalogProviderSyncRequest } from "./catalog-provider-sync.ts";

function b64(value: unknown): string { return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function token(organizationId = "org_1"): Promise<string> {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "staff_1", role: "admin", exp: 2_000_000_000, ...(organizationId ? { organization_id: organizationId } : {}) });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("provider-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${btoa(String.fromCharCode(...signature)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

async function orgAliasToken(): Promise<string> {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "staff_1", role: "admin", exp: 2_000_000_000, org_id: "org_1" });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("provider-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${btoa(String.fromCharCode(...signature)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

function database(projected: Array<{ artifact_type: string; external_id: string }> = []): WorkerDatabaseClient {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      if (sql.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 };
      if (sql.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [] as T[], rowCount: 1 };
      if (sql.startsWith("SELECT artifact_type, external_id") && sql.includes("catalog_provider_projections")) return { rows: projected as T[], rowCount: projected.length };
      return { rows: [] as T[], rowCount: 1 };
    },
    async end() {},
  };
}

test("provider sync requires an idempotency key", async () => {
  const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", { method: "POST" }), database(), { JWT_SECRET: "provider-secret" });
  assert.equal(response.status, 400);
});

test("provider sync requires an organization scope", async () => {
  const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${await token("")}`, "Idempotency-Key": "missing-org", "Content-Type": "application/json" },
    body: JSON.stringify({ productId: "product_1", title: "Canary", amountMinor: 100 }),
  }), database(), { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "organization_scope_required", code: "ORGANIZATION_SCOPE_REQUIRED" });
});

test("provider sync accepts the Supabase org_id tenant claim alias", async () => {
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCount += 1; return new Response("{}", { status: 500 }); };
  try {
    const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${await orgAliasToken()}`, "Idempotency-Key": "org-alias", "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "product_1", title: "Canary", amountMinor: 100 }),
    }), database(), { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" }, {
      async query<T extends Record<string, unknown>>() { return { rows: [{ id: "product_1" }] as T[], rowCount: 1 }; },
      async end() {},
    });
    assert.equal(response.status, 502);
    assert.ok(fetchCount > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider sync rejects a body idempotency key that disagrees with the signed request header", async () => {
  const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "header-key", "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: "body-key", productId: "product_1", title: "Canary", amountMinor: 100 }),
  }), database(), { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "idempotency_key_mismatch", code: "IDEMPOTENCY_KEY_MISMATCH" });
});

test("provider archival treats the Worker projection ledger as canonical", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    return new Response(JSON.stringify({ id: "unexpected" }), { status: 200 });
  };
  try {
  const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "archive-unowned" },
    body: JSON.stringify({ productId: "product_1", productExternalId: "prod_attacker" }),
  }), database(), { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { archived: false, productId: "product_1", reason: "no_provider_artifacts" } });
  assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider archival can replay for a soft-deleted product after commerce commit", async () => {
  const app = database([
    { artifact_type: "product", external_id: "prod_1" },
    { artifact_type: "price", external_id: "price_1" },
    { artifact_type: "payment_link", external_id: "plink_1" },
  ]);
  let ownerSql = "";
  let ownerValues: readonly unknown[] = [];
  const commerce: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      ownerSql = sql;
      ownerValues = values;
      return { rows: [{ id: "product_1" }] as T[], rowCount: 1 };
    },
    async end() {},
  };
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ id: "archived" }), { status: 200 });
  };
  try {
    const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "archive-replay" },
      body: JSON.stringify({ productId: "product_1" }),
    }), app, { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" }, commerce);
    assert.equal(response.status, 200);
    assert.deepEqual(ownerValues, ["product_1", "org_1", false]);
    assert.match(ownerSql, /\(\$3::boolean = false OR deleted_at IS NULL\)/);
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider sync ignores caller artifact ids and resolves ownership from its projection ledger", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    if (String(input).includes("/v1/products/prod_owner")) return new Response(JSON.stringify({ id: "prod_owner" }), { status: 200 });
    if (String(input).includes("/v1/products")) return new Response(JSON.stringify({ id: "prod_wrong" }), { status: 200 });
    if (String(input).includes("/v1/prices")) return new Response(JSON.stringify({ id: "price_new" }), { status: 200 });
    return new Response(JSON.stringify({ id: "plink_new", url: "https://buy.stripe.test/plink_new" }), { status: 200 });
  };
  try {
    const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "sync-unowned", "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "product_1", title: "Canary", amountMinor: 100, productExternalId: "prod_other" }),
    }), database([{ artifact_type: "product", external_id: "prod_owner" }]), { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" });
    assert.equal(response.status, 200);
    assert.equal(calls[0], "https://api.stripe.com/v1/products/prod_owner");
    assert.equal(calls.some((url) => url.includes("prod_other")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider sync creates artifacts, archives replaced projections, and persists the result", async () => {
  const calls: Array<{ method: string; url: string; key: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ method: init?.method ?? "GET", url: String(input), key: new Headers(init?.headers).get("Idempotency-Key") ?? "", body: String(init?.body ?? "") });
    if (String(input).includes("/v1/products")) return new Response(JSON.stringify({ id: "prod_new" }), { status: 200 });
    if (String(input).includes("/v1/prices")) return new Response(JSON.stringify({ id: "price_new" }), { status: 200 });
    return new Response(JSON.stringify({ id: "plink_new", url: "https://buy.stripe.test/plink_new" }), { status: 200 });
  };
  try {
    const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "provider-sync-1", "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "product_1", title: "Canary", amountMinor: 599700, currency: "PHP", productExternalId: "prod_old", priceExternalId: "price_old", paymentLinkExternalId: "plink_old" }),
    }), database([
      { artifact_type: "product", external_id: "prod_old" },
      { artifact_type: "price", external_id: "price_old" },
      { artifact_type: "payment_link", external_id: "plink_old" },
    ]), { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { productId: "prod_new", priceId: "price_new", paymentLinkId: "plink_new", paymentLinkUrl: "https://buy.stripe.test/plink_new" } });
    assert.equal(calls[0]?.method + " " + calls[0]?.url, "POST https://api.stripe.com/v1/products/prod_old");
    const oldLinkArchive = calls.findIndex((call) => call.url.endsWith("/payment_links/plink_old"));
    const oldPriceArchive = calls.findIndex((call) => call.url.endsWith("/prices/price_old"));
    assert.ok(oldLinkArchive >= 0 && oldPriceArchive > oldLinkArchive);
    assert.match(calls[oldLinkArchive]?.key ?? "", /^provider-sync-1:attempt:[0-9a-f-]+:archive:payment_link$/);
    assert.match(calls[oldPriceArchive]?.key ?? "", /^provider-sync-1:attempt:[0-9a-f-]+:archive:price$/);
    assert.match(calls[oldLinkArchive]?.body ?? "", /active=false/);
    assert.match(calls[oldPriceArchive]?.body ?? "", /active=false/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider sync leaves create artifacts retryable when local projection persistence fails", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; key: string; body: string }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), key: new Headers(init?.headers).get("Idempotency-Key") ?? "", body: String(init?.body ?? "") });
    if (String(input).includes("/v1/products")) return new Response(JSON.stringify({ id: "prod_retry", active: true }), { status: 200 });
    if (String(input).includes("/v1/prices")) return new Response(JSON.stringify({ id: "price_retry", active: true }), { status: 200 });
    return new Response(JSON.stringify({ id: "plink_retry", url: "https://buy.stripe.test/plink_retry", active: true }), { status: 200 });
  };
  const appDatabase: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      if (sql.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 };
      if (sql.startsWith("SELECT artifact_type, external_id")) return { rows: [] as T[], rowCount: 0 };
      if (sql.startsWith("INSERT INTO public.catalog_provider_projections")) throw new Error("simulated_projection_store_outage");
      if (sql.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [] as T[], rowCount: 1 };
      return { rows: [] as T[], rowCount: 1 };
    },
    async end() {},
  };
  const request = async () => new Request("https://worker.test/api/admin/catalog/provider-sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "projection-retry", "Content-Type": "application/json" },
    body: JSON.stringify({ productId: "product_1", title: "Canary", amountMinor: 599700, currency: "PHP" }),
  });
  try {
    const commerce: WorkerDatabaseClient = { query: async <T extends Record<string, unknown>>() => ({ rows: [{ id: "product_1" }] as T[], rowCount: 1 }), async end() {} };
    const first = await handleCatalogProviderSyncRequest(await request(), appDatabase, { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" }, commerce);
    assert.equal(first.status, 502);
    const firstCreateKeys = calls.map((call) => call.key);
    assert.equal(calls.length, 3);
    assert.equal(calls.some((call) => /active=false/.test(call.body)), false);
    const second = await handleCatalogProviderSyncRequest(await request(), appDatabase, { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" }, commerce);
    assert.equal(second.status, 502);
    assert.deepEqual(calls.slice(3).map((call) => call.key), firstCreateKeys);
    assert.equal(calls.some((call) => /active=false/.test(call.body)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
