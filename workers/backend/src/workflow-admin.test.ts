import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminWorkflowEntitiesRequest } from "./workflow-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const header = encode({ alg: "HS256", typ: "JWT" }); const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`; }

test("workflow entity reads are tenant scoped, projected, and bounded", async () => {
  let query = "";
  const database: WorkerDatabaseClient = { async query(text: string, values: readonly unknown[]) { query = text; assert.deepEqual(values, ["org_1", "cms_page", 25, 4]); return { rows: [], rowCount: 0 }; }, async end() {} };
  const response = await handleAdminWorkflowEntitiesRequest(new Request("https://api.test/api/admin/workflow/entities?entity_type=cms_page&limit=25&offset=4", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.ok(query.includes("organization_id = $1") && query.includes("entity_type = $2") && query.includes("LIMIT $3 OFFSET $4") && !query.includes("SELECT *"));
});

test("workflow entity reads reject invalid pagination before querying", async () => {
  const database: WorkerDatabaseClient = { async query() { throw new Error("database_should_not_be_called"); }, async end() {} };
  const response = await handleAdminWorkflowEntitiesRequest(new Request("https://api.test/api/admin/workflow/entities?limit=201", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 400);
});
