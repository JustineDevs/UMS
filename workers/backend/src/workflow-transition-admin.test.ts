import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminWorkflowTransitionRequest } from "./workflow-transition-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(permission = "campaigns:write"): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", email: "staff@example.test", role: "staff", organization_id: "org_1", permissions: [permission], exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }
const url = "https://api.test/api/admin/workflow/transition";

test("workflow transition requires staff auth and durable idempotency", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database_should_not_be_called"); }, async end() {} };
  const unauthenticated = await handleAdminWorkflowTransitionRequest(new Request(url, { method: "POST" }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_1");
  assert.equal(unauthenticated.status, 401);
  const missingKey = await handleAdminWorkflowTransitionRequest(new Request(url, { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ entity_type: "campaign", entity_id: "c1", to_state: "approved" }) }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_2");
  assert.equal(missingKey.status, 400);
});

test("workflow transition validates state before database access", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database_should_not_be_called"); }, async end() {} };
  const response = await handleAdminWorkflowTransitionRequest(new Request(url, { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "workflow-1", "Content-Type": "application/json" }, body: JSON.stringify({ entity_type: "campaign", entity_id: "c1", to_state: "unknown" }) }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_3");
  assert.equal(response.status, 400);
});

test("workflow transition scopes the entity, persists the state, and audits", async () => {
  const queries: string[] = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { queries.push(text); if (text.includes("SELECT id FROM public.campaigns")) return { rows: [{ id: "c1" }], rowCount: 1 } as { rows: T[]; rowCount: number }; if (text.includes("SELECT state, updated_at")) return { rows: [{ state: "draft", updated_at: "2026-01-01T00:00:00.000Z" }], rowCount: 1 } as { rows: T[]; rowCount: number }; if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" }], rowCount: 1 } as { rows: T[]; rowCount: number }; return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; }, async end() {} };
  const response = await handleAdminWorkflowTransitionRequest(new Request(url, { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "workflow-2", "Content-Type": "application/json" }, body: JSON.stringify({ entity_type: "campaign", entity_id: "c1", to_state: "pending_review" }) }), database, database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, "req_4");
  assert.equal(response.status, 200); assert.ok(queries.some((query) => query.includes("organization_id") && query.includes("ON CONFLICT"))); assert.ok(queries.some((query) => query.includes("INSERT INTO public.audit_logs")));
});
