import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleAdminTasksTodayRequest } from "./tasks-admin.ts";

function token(): string { const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const h = enc({ alg: "HS256", typ: "JWT" }); const p = enc({ sub: "staff_1", role: "admin", org_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`; }

test("today tasks are tenant-scoped, bounded aggregates", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = { query: async (text: string, values: readonly unknown[] = []) => { queries.push({ text, values }); return text.includes("ANY") ? { rows: [{ count: "6" }], rowCount: 1 } : { rows: [{ count: "2" }], rowCount: 1 }; }, end: async () => {} };
  const response = await handleAdminTasksTodayRequest(new Request("https://api.test/api/admin/tasks/today", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  const body = await response.json() as { tasks: Array<{ id: string; urgency: string }> };
  assert.equal(response.status, 200); assert.deepEqual(body.tasks.map((task) => task.id), ["stale-payment-attempts", "payment-needs-review"]); assert.equal(body.tasks[0].urgency, "high"); assert.equal(queries.length, 2); assert.ok(queries.every(({ text, values }) => text.includes("organization_id = $1") && text.includes("COUNT(*)") && values[0] === "org_1"));
});
