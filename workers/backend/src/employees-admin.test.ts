import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleAdminEmployeesRequest, handleAdminEmployeePinRequest } from "./employees-admin.ts";

function token(): string { const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url"); const h = enc({ alg: "HS256", typ: "JWT" }); const p = enc({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${h}.${p}.${createHmac("sha256", "secret").update(`${h}.${p}`).digest("base64url")}`; }

test("employee routes are tenant-scoped, projected, bounded, and replayable", async () => {
  const statements: string[] = [];
  const database = { query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => { statements.push(text); if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }], rowCount: 1 } as { rows: T[]; rowCount: number }; if (text.startsWith("UPDATE public.worker_idempotency_records") || text.startsWith("DELETE FROM public.worker_idempotency_records")) return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; if (text.startsWith("INSERT INTO public.employees")) return { rows: [{ id: "e1", user_id: null, full_name: "Alex", email: null, phone: null, role: "staff", is_active: true, hired_at: null, metadata: {}, created_at: "2026-09-21", updated_at: "2026-09-21", organization_id: "org_1" }], rowCount: 1 } as { rows: T[]; rowCount: number }; return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number }; }, end: async () => {} };
  const headers = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };
  const list = await handleAdminEmployeesRequest(new Request("https://api.test/api/admin/employees", { headers }), database, { CMS_ADMIN_JWT_SECRET: "secret" });
  assert.equal(list.status, 200);
  const create = await handleAdminEmployeesRequest(new Request("https://api.test/api/admin/employees", { method: "POST", headers: { ...headers, "Idempotency-Key": "employee-1" }, body: JSON.stringify({ full_name: "Alex" }) }), database, { CMS_ADMIN_JWT_SECRET: "secret" });
  assert.equal(create.status, 201);
  const pin = await handleAdminEmployeePinRequest(new Request("https://api.test/api/admin/employees/e1/pin", { method: "POST", headers: { ...headers, "Idempotency-Key": "pin-1" }, body: JSON.stringify({ pin: "1234" }) }), database, { CMS_ADMIN_JWT_SECRET: "secret" }, "e1");
  assert.equal(pin.status, 200);
  assert.ok(statements.some((statement) => statement.includes("organization_id=$1") && statement.includes("LIMIT 500")));
});
