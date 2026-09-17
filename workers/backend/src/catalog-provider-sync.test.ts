import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCatalogProviderSyncRequest } from "./catalog-provider-sync.ts";

function b64(value: unknown): string { return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function token(): Promise<string> {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "staff_1", role: "admin", exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("provider-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${btoa(String.fromCharCode(...signature)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

function database(): WorkerDatabaseClient {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      if (sql.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as unknown as T[], rowCount: 1 };
      if (sql.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [] as T[], rowCount: 1 };
      return { rows: [] as T[], rowCount: 1 };
    },
    async end() {},
  };
}

test("provider sync requires an idempotency key", async () => {
  const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", { method: "POST" }), database(), { JWT_SECRET: "provider-secret" });
  assert.equal(response.status, 400);
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

test("provider archival rejects external ids that are not projected for the product", async () => {
  const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "archive-unowned" },
    body: JSON.stringify({ productId: "product_1", productExternalId: "prod_attacker" }),
  }), database(), { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "provider_artifact_not_owned", code: "PROVIDER_ARTIFACT_NOT_OWNED" });
});

test("provider sync creates artifacts, archives replaced projections, and persists the result", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push(`${init?.method ?? "GET"} ${String(input)}`);
    if (String(input).includes("/v1/products")) return new Response(JSON.stringify({ id: "prod_new" }), { status: 200 });
    if (String(input).includes("/v1/prices")) return new Response(JSON.stringify({ id: "price_new" }), { status: 200 });
    return new Response(JSON.stringify({ id: "plink_new", url: "https://buy.stripe.test/plink_new" }), { status: 200 });
  };
  try {
    const response = await handleCatalogProviderSyncRequest(new Request("https://worker.test/api/admin/catalog/provider-sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Idempotency-Key": "provider-sync-1", "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "product_1", title: "Canary", amountMinor: 599700, currency: "PHP", productExternalId: "prod_old", priceExternalId: "price_old", paymentLinkExternalId: "plink_old" }),
    }), database(), { JWT_SECRET: "provider-secret", STRIPE_API_KEY: "sk_test_provider" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { productId: "prod_new", priceId: "price_new", paymentLinkId: "plink_new", paymentLinkUrl: "https://buy.stripe.test/plink_new" } });
    assert.equal(calls[0], "POST https://api.stripe.com/v1/products/prod_old");
    assert.ok(calls.includes("POST https://api.stripe.com/v1/prices/price_old"));
    assert.ok(calls.includes("POST https://api.stripe.com/v1/payment_links/plink_old"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
