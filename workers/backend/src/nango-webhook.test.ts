import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleNangoWebhook } from "./nango-webhook.ts";

const secret = "test-nango-signing-key";
const encoder = new TextEncoder();

async function signature(body: string): Promise<string> {
  const key = await webcrypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await webcrypto.subtle.sign("HMAC", key, encoder.encode(body)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function makeRequest(body: string, hmac: string, event = "event-12345678") {
  return new Request("https://worker.test/api/webhooks/nango", { method: "POST", headers: { "content-type": "application/json", "x-nango-hmac-sha256": hmac, "x-nango-event-id": event }, body });
}

function database(options: { replayed?: boolean; existingOrganization?: string } = {}) {
  const statements: string[] = [];
  let committed = false;
  let rolledBack = false;
  const db: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string) {
      statements.push(sql);
      if (sql === "BEGIN") return { rows: [], rowCount: 0 };
      if (sql === "COMMIT") { committed = true; return { rows: [], rowCount: 0 }; }
      if (sql === "ROLLBACK") { rolledBack = true; return { rows: [], rowCount: 0 }; }
      if (sql.includes("INSERT INTO public.admin_webhook_replays")) return { rows: options.replayed ? [] : [{ nonce: "event" }] as T[], rowCount: options.replayed ? 0 : 1 };
      if (sql.includes("SELECT organization_id, nango_connection_id FROM public.payment_nango_connections")) return { rows: options.existingOrganization ? [{ organization_id: options.existingOrganization, nango_connection_id: "old" }] as T[] : [], rowCount: options.existingOrganization ? 1 : 0 };
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  return { db, statements, didCommit: () => committed, didRollback: () => rolledBack };
}

const payload = JSON.stringify({ type: "auth", operation: "creation", success: true, providerConfigKey: "paypal-sandbox", connectionId: "nango-connection-1", provider: "paypal", tags: { end_user_id: "owner@example.com", organization_id: "org-1" } });

test("rejects invalid Nango HMAC before database access", async () => {
  const db = database();
  const response = await handleNangoWebhook(makeRequest(payload, "0".repeat(64)), db.db, { NANGO_WEBHOOK_SIGNING_KEY: secret });
  assert.equal(response.status, 401);
  assert.deepEqual(db.statements, []);
});

test("atomically records a verified Nango connection and replay id", async () => {
  const db = database();
  const response = await handleNangoWebhook(makeRequest(payload, await signature(payload)), db.db, { NANGO_WEBHOOK_SIGNING_KEY: secret });
  assert.equal(response.status, 200);
  assert.equal(db.didCommit(), true);
  assert.equal(db.didRollback(), false);
  assert.ok(db.statements.some((sql) => sql.includes("ON CONFLICT (provider_config_key, merchant_identity)")));
});

test("acknowledges duplicate event id without repeating the connection write", async () => {
  const db = database({ replayed: true });
  const response = await handleNangoWebhook(makeRequest(payload, await signature(payload)), db.db, { NANGO_WEBHOOK_SIGNING_KEY: secret });
  assert.deepEqual(await response.json(), { accepted: true, deduplicated: true });
  assert.equal(db.statements.some((sql) => sql.includes("INSERT INTO public.payment_nango_connections")), false);
  assert.equal(db.didCommit(), true);
});

test("rolls back ownership conflicts so a corrected delivery can be retried", async () => {
  const db = database({ existingOrganization: "other-org" });
  const response = await handleNangoWebhook(makeRequest(payload, await signature(payload)), db.db, { NANGO_WEBHOOK_SIGNING_KEY: secret });
  assert.equal(response.status, 409);
  assert.equal(db.didRollback(), true);
  assert.equal(db.didCommit(), false);
  assert.equal(db.statements.some((sql) => sql.includes("INSERT INTO public.payment_nango_connections")), false);
});

test("rejects oversized body without reading it into memory", async () => {
  const request = new Request("https://worker.test/api/webhooks/nango", { method: "POST", headers: { "content-length": "256001" }, body: "{}" });
  const db = database();
  const response = await handleNangoWebhook(request, db.db, { NANGO_WEBHOOK_SIGNING_KEY: secret });
  assert.equal(response.status, 413);
  assert.deepEqual(db.statements, []);
});
