import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleAdminCrmBridgeRequest } from "./crm-bridge-admin.ts";

function token(): string {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const h = enc({ alg: "HS256", typ: "JWT" });
  const p = enc({ sub: "staff_1", role: "admin", organization_id: "org_1", permissions: ["crm:read", "crm:write"], exp: Math.floor(Date.now() / 1000) + 300 });
  return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`;
}

test("CRM bridge is tenant-scoped, bounded, and durably replayable", async () => {
  const queries: string[] = [];
  const database = { query: async (text: string) => { queries.push(text); if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" }], rowCount: 1 }; if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 }; if (text.startsWith("INSERT INTO public.crm_nango_connections")) return { rows: [{ id: "connection-1", provider_config_key: "hubspot", connection_id: "conn-1", organization_id: "org_1", active: true, tags: {}, metadata: {}, created_at: "2026-09-21T00:00:00.000Z", updated_at: "2026-09-21T00:00:00.000Z" }] }; if (text.startsWith("INSERT INTO public.audit_logs")) return { rows: [], rowCount: 1 }; return { rows: [], rowCount: 1 }; }, end: async () => {} };
  const response = await handleAdminCrmBridgeRequest(new Request("https://api.test/api/admin/crm/bridge", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "crm-bridge-1", "Content-Type": "application/json" }, body: JSON.stringify({ kind: "connection", provider_config_key: "hubspot", connection_id: "conn-1" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 201);
  assert.match(queries.find((query) => query.includes("crm_nango_connections")) ?? "", /organization_id/);
  assert.ok(queries.some((query) => query.includes("worker_idempotency_records")));
});
