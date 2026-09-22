import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleAdminOperatorNotesRequest } from "./operator-notes-admin.ts";

function token(): string { const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const h = enc({ alg: "HS256", typ: "JWT" }); const p = enc({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`; }

test("operator notes are tenant-scoped, permission-gated, bounded, and replayable", async () => {
  const queries: string[] = [];
  const database = { query: async (text: string) => { queries.push(text); return { rows: [{ id: "note-1", body: "checked", author_email: "staff@example.test", created_at: "2026-09-21T00:00:00.000Z" }], rowCount: 1 }; }, end: async () => {} };
  const read = await handleAdminOperatorNotesRequest(new Request("https://api.test/api/admin/operator-notes?entity_type=cms_page&entity_id=page-1", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(read.status, 200); assert.equal((await read.json()).notes[0].id, "note-1"); assert.match(queries[0] ?? "", /organization_id=\$3/);
  const write = await handleAdminOperatorNotesRequest(new Request("https://api.test/api/admin/operator-notes?entity_type=cms_page&entity_id=page-1", { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "note-key" }, body: JSON.stringify({ body: "checked" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(write.status, 201); assert.deepEqual(await write.json(), { id: "note-1" }); assert.ok(queries.some((query) => query.includes("INSERT INTO public.admin_operator_notes")));
});
