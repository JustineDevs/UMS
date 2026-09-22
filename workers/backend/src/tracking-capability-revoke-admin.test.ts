import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminTrackingCapabilityRevokeRequest } from "./tracking-capability-revoke-admin.ts";

function jwt(): string {
  const enc = (value: string) => Buffer.from(value).toString("base64url");
  const header = enc(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = enc(JSON.stringify({ sub: "staff-1", email: "staff@example.com", role: "admin", organization_id: "00000000-0000-4000-8000-000000000001", exp: Math.floor(Date.now() / 1000) + 300 }));
  const input = `${header}.${payload}`;
  return `${input}.${createHmac("sha256", "jwt-secret").update(input).digest("base64url")}`;
}

test("tracking revocation rejects invalid capability without a write", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database must not be queried"); }, async end() {} };
  const response = await handleAdminTrackingCapabilityRevokeRequest(new Request("https://api.example/api/admin/tracking-capabilities/revoke", { method: "POST", headers: { Authorization: `Bearer ${jwt()}`, "Idempotency-Key": "k1", "Content-Type": "application/json" }, body: JSON.stringify({ token: "bad", resourceId: "order_1" }) }), database, { CMS_ADMIN_JWT_SECRET: "jwt-secret", TRACKING_HMAC_SECRET: "tracking-secret" });
  assert.equal(response.status, 400);
});
