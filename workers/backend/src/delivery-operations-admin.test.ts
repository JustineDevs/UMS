import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminDeliveryOperationsRequest } from "./delivery-operations-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 });
  return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`;
}

test("delivery operations GET is tenant scoped and bounded", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number }; }, async end() {} };
  const response = await handleAdminDeliveryOperationsRequest(new Request("https://api.test/api/admin/delivery-logistics/operations", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.equal(queries.length, 2);
  assert.ok(queries.every((query) => query.text.includes("tenant_key = $1") && query.text.includes("LIMIT $2")));
  assert.deepEqual(queries[0]?.values, ["org_1", 200]);
});

test("delivery operation writes require idempotency and fail closed when providers are absent", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "claimed" }] as unknown as T[], rowCount: 1 }; if (text.includes("DELETE FROM public.worker_idempotency_records")) return { rows: [], rowCount: 1 }; throw new Error("database_should_not_be_called"); }, async end() {} };
  const base = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };
  const missing = await handleAdminDeliveryOperationsRequest(new Request("https://api.test/api/admin/delivery-logistics/operations", { method: "POST", headers: base, body: JSON.stringify({ kind: "geocode", address: "Manila" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
  const unavailable = await handleAdminDeliveryOperationsRequest(new Request("https://api.test/api/admin/delivery-logistics/operations", { method: "POST", headers: { ...base, "Idempotency-Key": "geo-1" }, body: JSON.stringify({ kind: "geocode", address: "Manila" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(unavailable.status, 503);
});
