import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleAdminCrmNotesRequest } from "./crm-notes-admin.ts";

const encoder = new TextEncoder();
const keysPromise = webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const noteId = "6e90e76c-4d6d-4d3c-9ba8-61dcbab018d4";

function encode(value: unknown): string { return base64url(encoder.encode(JSON.stringify(value))); }
function base64url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function fixture(options: { role?: string; grants?: string[]; organizationId?: string; failAudit?: boolean } = {}) {
  const keys = await keysPromise;
  const publicKey = await webcrypto.subtle.exportKey("jwk", keys.publicKey);
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "ES256", typ: "JWT", kid: "crm-test-key" });
  const payload = encode({ sub: "auth-user-1", email: "Staff@Example.test", aud: "authenticated", iss: "https://supabase.test/auth/v1", iat: now, exp: now + 600 });
  const message = `${header}.${payload}`;
  const signature = new Uint8Array(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, encoder.encode(message)));
  const authorization = `Bearer ${message}.${base64url(signature)}`;
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  let notes: Array<Record<string, unknown>> = [];
  const idempotency = new Map<string, Record<string, unknown>>();
  let transactionSnapshot: { notes: Array<Record<string, unknown>>; idempotency: Map<string, Record<string, unknown>> } | null = null;
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      calls.push({ sql, values });
      let rows: Record<string, unknown>[] = [];
      let rowCount = 0;
      if (sql === "BEGIN") {
        transactionSnapshot = { notes: structuredClone(notes), idempotency: structuredClone(idempotency) };
      } else if (sql === "COMMIT") transactionSnapshot = null;
      else if (sql === "ROLLBACK" && transactionSnapshot) {
        notes = transactionSnapshot.notes;
        idempotency.clear();
        for (const [key, row] of transactionSnapshot.idempotency) idempotency.set(key, row);
        transactionSnapshot = null;
      } else if (sql.includes("FROM public.users")) rows = [{ id: "staff-user-1" }];
      else if (sql.includes("FROM public.organization_memberships")) rows = [{ organization_id: options.organizationId ?? "org-a", role: "owner" }];
      else if (sql.includes("FROM public.user_roles")) rows = [{ role: options.role ?? "admin" }];
      else if (sql.includes("FROM public.staff_permission_grants")) rows = (options.grants ?? []).map((permission_key) => ({ permission_key }));
      else if (sql.startsWith("SELECT idempotency_key, request_hash, response_status")) {
        const row = idempotency.get(String(values[0]));
        if (row) rows = [row];
      } else if (sql.includes("INSERT INTO public.worker_idempotency_records")) {
        const [key, hash, createdAt] = values as [string, string, number, number];
        if (!idempotency.has(key)) {
          idempotency.set(key, { idempotency_key: key, request_hash: hash, state: "pending", response_status: 102, response_headers: [], response_body: "", created_at: new Date(createdAt).toISOString() });
          rows = [{ state: "pending", request_hash: hash }];
          rowCount = 1;
        }
      } else if (sql.includes("FROM public.worker_idempotency_records WHERE idempotency_key")) {
        const row = idempotency.get(String(values[0]));
        if (row) rows = [row];
      } else if (sql.startsWith("UPDATE public.worker_idempotency_records")) {
        const [key, hash, status, headers, body, createdAt] = values as [string, string, number, string, string, number, number];
        const row = idempotency.get(key);
        if (row?.request_hash === hash && row.state === "pending") {
          Object.assign(row, { state: "completed", response_status: status, response_headers: JSON.parse(headers), response_body: body, created_at: new Date(createdAt).toISOString() });
          rowCount = 1;
        }
      } else if (sql.startsWith("DELETE FROM public.worker_idempotency_records")) {
        const [key, hash] = values as [string, string];
        if (idempotency.get(key)?.request_hash === hash) idempotency.delete(key);
        rowCount = 1;
      } else if (sql.startsWith("SELECT id,note_body")) {
        rows = notes.filter((row) => row.customer_email === values[0] && row.organization_id === values[1] && row.is_deleted === false);
      } else if (sql.startsWith("INSERT INTO public.staff_customer_notes")) {
        const [organization_id, customer_email, note_body, author_email] = values;
        const row = { id: noteId, organization_id, customer_email, note_body, author_email, created_at: "2026-09-21T00:00:00.000Z", is_deleted: false };
        notes.push(row);
        rows = [row];
        rowCount = 1;
      } else if (sql.startsWith("UPDATE public.staff_customer_notes")) {
        const row = notes.find((entry) => entry.id === values[0] && entry.organization_id === values[1] && entry.is_deleted === false);
        if (row) { row.is_deleted = true; rows = [{ customer_email: row.customer_email }]; rowCount = 1; }
      } else if (sql.startsWith("INSERT INTO public.audit_logs")) {
        if (options.failAudit) throw new Error("audit_store_unavailable");
        rowCount = 1;
      }
      return { rows: rows as T[], rowCount };
    },
    async end() {},
  };
  const env = {
    SUPABASE_URL: "https://supabase.test",
    fetch: async (input: string | URL) => String(input).endsWith("/auth/v1/.well-known/jwks.json")
      ? Response.json({ keys: [{ ...publicKey, kid: "crm-test-key", alg: "ES256", use: "sig" }] })
      : new Response(null, { status: 404 }),
  };
  return { authorization, database, env, calls, notes: () => notes, idempotency };
}

function request(path: string, authorization: string, method = "GET", body?: string, key?: string) {
  return new Request(`https://api.test${path}`, {
    method,
    headers: { Authorization: authorization, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(key ? { "Idempotency-Key": key } : {}) },
    body,
  });
}

test("CRM note reads resolve Supabase staff and scope by the database membership", async () => {
  const auth = await fixture({ organizationId: "db-org" });
  const response = await handleAdminCrmNotesRequest(request("/notes?customer_email=Customer%40Example.test", auth.authorization), auth.database, auth.env);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
  assert.deepEqual(auth.calls.find(({ sql }) => sql.startsWith("SELECT id,note_body"))?.values, ["customer@example.test", "db-org"]);
});

test("CRM notes reject custom unsigned identity claims and missing staff permission", async () => {
  const auth = await fixture({ role: "staff", grants: [] });
  const denied = await handleAdminCrmNotesRequest(request("/notes?customer_email=customer%40example.test", auth.authorization), auth.database, auth.env);
  assert.equal(denied.status, 403);
  const invalid = await handleAdminCrmNotesRequest(request("/notes?customer_email=customer%40example.test", "Bearer invalid"), auth.database, auth.env);
  assert.equal(invalid.status, 401);
});

test("CRM staff with explicit grants may create notes without elevating organization role", async () => {
  const auth = await fixture({ role: "staff", grants: ["crm:write"] });
  const req = request("/notes?customer_email=customer%40example.test", auth.authorization, "POST", JSON.stringify({ note_body: "approved follow-up" }), "staff-note-create");
  const response = await handleAdminCrmNotesRequest(req, auth.database, auth.env);
  assert.equal(response.status, 201);
  assert.equal(auth.notes()[0].organization_id, "org-a");
});

test("CRM note creation atomically audits and replays one scoped mutation", async () => {
  const auth = await fixture();
  const make = () => request("/notes?customer_email=Customer%40Example.test", auth.authorization, "POST", JSON.stringify({ note_body: "  Follow up  " }), "same-note-attempt");
  const first = await handleAdminCrmNotesRequest(make(), auth.database, auth.env);
  const replay = await handleAdminCrmNotesRequest(make(), auth.database, auth.env);
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  assert.equal(auth.notes().length, 1);
  assert.equal(auth.calls.filter(({ sql }) => sql.startsWith("INSERT INTO public.audit_logs")).length, 1);
  const insert = auth.calls.find(({ sql }) => sql.startsWith("INSERT INTO public.staff_customer_notes"));
  assert.deepEqual(insert?.values, ["org-a", "customer@example.test", "Follow up", "staff@example.test"]);
  assert.ok(auth.calls.some(({ sql }) => sql === "BEGIN"));
  assert.ok(auth.calls.some(({ sql }) => sql === "COMMIT"));
});

test("CRM note idempotency key cannot be replayed with a different body", async () => {
  const auth = await fixture();
  const make = (note_body: string) => request("/notes?customer_email=customer%40example.test", auth.authorization, "POST", JSON.stringify({ note_body }), "same-note-attempt");
  assert.equal((await handleAdminCrmNotesRequest(make("first note"), auth.database, auth.env)).status, 201);
  const conflict = await handleAdminCrmNotesRequest(make("different note"), auth.database, auth.env);
  assert.equal(conflict.status, 409);
  assert.equal(auth.notes().length, 1);
});

test("CRM note creation rolls back the note and idempotency claim when audit persistence fails", async () => {
  const auth = await fixture({ failAudit: true });
  const req = request("/notes?customer_email=customer%40example.test", auth.authorization, "POST", JSON.stringify({ note_body: "note" }), "audit-failure-key");
  await assert.rejects(handleAdminCrmNotesRequest(req, auth.database, auth.env), /audit_store_unavailable/);
  assert.equal(auth.notes().length, 0);
  assert.equal(auth.idempotency.size, 0);
  assert.ok(auth.calls.some(({ sql }) => sql === "ROLLBACK"));
});

test("CRM note delete is tenant-scoped and replay-safe", async () => {
  const auth = await fixture();
  const create = request("/notes?customer_email=customer%40example.test", auth.authorization, "POST", JSON.stringify({ note_body: "note" }), "create-note-key");
  await handleAdminCrmNotesRequest(create, auth.database, auth.env);
  const remove = () => request(`/notes/${noteId}`, auth.authorization, "DELETE", undefined, "delete-note-key");
  const first = await handleAdminCrmNotesRequest(remove(), auth.database, auth.env, noteId);
  const replay = await handleAdminCrmNotesRequest(remove(), auth.database, auth.env, noteId);
  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  assert.equal(auth.notes()[0].is_deleted, true);
  const otherTenant = await fixture({ organizationId: "org-b" });
  const notFound = await handleAdminCrmNotesRequest(removeFor(otherTenant.authorization), otherTenant.database, otherTenant.env, noteId);
  assert.equal(notFound.status, 404);
});

function removeFor(authorization: string) {
  return request(`/notes/${noteId}`, authorization, "DELETE", undefined, "delete-note-key");
}

test("CRM note input is strictly validated and bounded", async () => {
  const auth = await fixture();
  const duplicateEmail = await handleAdminCrmNotesRequest(request("/notes?customer_email=a%40example.test&customer_email=b%40example.test", auth.authorization), auth.database, auth.env);
  const extraField = await handleAdminCrmNotesRequest(request("/notes?customer_email=a%40example.test", auth.authorization, "POST", JSON.stringify({ note_body: "ok", organization_id: "victim" }), "extra-field-key"), auth.database, auth.env);
  const tooLarge = await handleAdminCrmNotesRequest(request("/notes?customer_email=a%40example.test", auth.authorization, "POST", `{"note_body":"${"a".repeat(16 * 1024)}"}`, "large-body-key"), auth.database, auth.env);
  const invalidId = await handleAdminCrmNotesRequest(request("/notes/not-a-uuid", auth.authorization, "DELETE", undefined, "invalid-id-key"), auth.database, auth.env, "not-a-uuid");
  assert.equal(duplicateEmail.status, 400);
  assert.equal(extraField.status, 400);
  assert.equal(tooLarge.status, 413);
  assert.equal(invalidId.status, 400);
});
