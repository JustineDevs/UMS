import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleAdminRolesRequest } from "./roles-admin.ts";

function token(): string { const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const h = enc({ alg: "HS256", typ: "JWT" }); const p = enc({ sub: "staff_1", role: "admin", exp: Math.floor(Date.now() / 1000) + 300 }); return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`; }

test("roles summary is permission-gated and uses bounded projections", async () => {
  const queries: string[] = []; let index = 0;
  const database = { query: async (text: string) => { queries.push(text); index += 1; if (text.includes("public.users")) return { rows: [{ id: "u1", created_at: "2026-01-01T00:00:00.000Z" }], rowCount: 1 }; if (text.includes("public.user_roles")) return { rows: [{ user_id: "u1", role: "staff" }], rowCount: 1 }; return { rows: [{ user_id: "u1", permission_key: "inventory:read" }], rowCount: 1 }; }, end: async () => {} };
  const response = await handleAdminRolesRequest(new Request("https://api.test/api/admin/roles", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.equal((await response.json()).data[0].permissionSets[0], "inventory:read"); assert.equal(queries.length, 3); assert.ok(queries.every((query) => query.includes("LIMIT"))); assert.ok(queries.every((query) => !query.includes("SELECT *")));
});
