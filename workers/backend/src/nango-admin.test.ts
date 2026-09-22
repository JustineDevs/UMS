import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleNangoAdminRequest } from "./nango-admin.ts";

const encoder = new TextEncoder();
const keyPairPromise = webcrypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

async function bearer(email = "owner@example.com", role = "admin", membershipRole = "owner", permissionRows: string[] = []) {
  const keyPair = await keyPairPromise;
  const publicKey = await webcrypto.subtle.exportKey("jwk", keyPair.publicKey);
  const header = encode({ alg: "ES256", typ: "JWT", kid: "nango-test-key" });
  const now = Math.floor(Date.now() / 1000);
  const claims = encode({ sub: "auth-user-1", email, aud: "authenticated", iss: "https://supabase.test/auth/v1", iat: now, exp: now + 600 });
  const message = `${header}.${claims}`;
  const signature = new Uint8Array(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, encoder.encode(message)));
  const token = `${message}.${base64url(signature)}`;
  const dbCalls: string[] = [];
  const idempotency = new Map<string, { key: string; hash: string; state: string; status: number; headers: Array<[string, string]>; body: string; createdAt: number; expiresAt: number }>();
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      dbCalls.push(sql);
      let rows: Record<string, unknown>[] = [];
      let rowCount = 0;
      if (sql.includes("INSERT INTO public.worker_idempotency_records")) {
        const [key, hash, createdAt, ttl] = values as [string, string, number, number];
        const prior = idempotency.get(key);
        if (!prior || prior.expiresAt <= Date.now()) {
          idempotency.set(key, { key, hash, state: "pending", status: 102, headers: [], body: "", createdAt, expiresAt: Date.now() + ttl * 1000 });
          rows = [{ state: "pending", request_hash: hash }];
          rowCount = 1;
        }
      } else if (sql.startsWith("UPDATE public.worker_idempotency_records")) {
        const [key, hash, status, headers, body, createdAt, ttl] = values as [string, string, number, string, string, number, number];
        const row = idempotency.get(key);
        if (row?.hash === hash && row.state === "pending") {
          Object.assign(row, { state: "completed", status, headers: JSON.parse(headers), body, createdAt, expiresAt: createdAt + ttl * 1000 });
          rowCount = 1;
        }
      } else if (sql.startsWith("DELETE FROM public.worker_idempotency_records")) {
        const [key, hash] = values as [string, string];
        const row = idempotency.get(key);
        if (row?.hash === hash && row.state === "pending") { idempotency.delete(key); rowCount = 1; }
      } else if (sql.includes("FROM public.worker_idempotency_records")) {
        const row = idempotency.get(String(values[0]));
        if (row && row.expiresAt > Date.now()) rows = [{ idempotency_key: row.key, request_hash: row.hash, state: row.state, response_status: row.status, response_headers: row.headers, response_body: row.body, created_at: new Date(row.createdAt).toISOString() }];
      } else if (sql.includes("FROM public.users")) rows = [{ id: "user-1" }];
      else if (sql.includes("FROM public.organization_memberships")) rows = [{ organization_id: "org-1", role: membershipRole }];
      else if (sql.includes("FROM public.user_roles")) rows = [{ role }];
      else if (sql.includes("FROM public.staff_permission_grants")) rows = permissionRows.map((permission_key) => ({ permission_key }));
      else if (sql.includes("FROM public.payment_nango_connections") || sql.includes("FROM public.crm_nango_connections")) rows = [{ nango_connection_id: String(values[3] ?? values[2] ?? "connection-1") }];
      return { rows: rows as T[], rowCount: sql.includes("worker_idempotency_records") ? rowCount : rows.length };
    },
    async end() {},
  };
  return { authorization: `Bearer ${token}`, database, dbCalls, publicKey };
}

function encode(value: unknown): string { return base64url(encoder.encode(JSON.stringify(value))); }
function base64url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function request(path: string, method: string, authorization: string, body?: unknown, idempotencyKey = "nango-test-key") {
  return new Request(`https://api.test${path}`, {
    method,
    headers: { Authorization: authorization, ...(body ? { "Content-Type": "application/json" } : {}), ...(method === "GET" || idempotencyKey === "" ? {} : { "Idempotency-Key": idempotencyKey }) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function env(publicKey: object, remote: (_url: string, _init?: RequestInit) => Promise<Response>, overrides: Record<string, unknown> = {}) {
  return {
    SUPABASE_URL: "https://supabase.test",
    NANGO_API_KEY: "server-secret",
    NANGO_PAYMENT_INTEGRATIONS: "paypal-sandbox,stripe",
    NANGO_CRM_INTEGRATIONS: "hubspot",
    fetch: async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/.well-known/jwks.json")) return Response.json({ keys: [{ ...publicKey, kid: "nango-test-key", alg: "ES256", use: "sig" }] });
      return remote(url, init);
    },
    ...overrides,
  };
}

test("Nango payment connect session is owner-scoped and uses supported identity fields", async () => {
  const auth = await bearer();
  let payload: Record<string, unknown> | undefined;
  const response = await handleNangoAdminRequest(request("/api/admin/payments/connect-session", "POST", auth.authorization, { integration_id: "paypal-sandbox" }), auth.database, env(auth.publicKey, async (_url, init) => {
    payload = JSON.parse(String(init?.body));
    return Response.json({ data: { token: "one-time-session" } });
  }), "payment");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as { data: { session_token: string } }).data.session_token, "one-time-session");
  assert.deepEqual(payload?.allowed_integrations, ["paypal-sandbox"]);
  assert.deepEqual(payload?.end_user, { id: "owner@example.com", email: "owner@example.com" });
  assert.deepEqual(payload?.organization, { id: "org-1" });
});

test("Nango status filters out other users and organizations", async () => {
  const auth = await bearer();
  const response = await handleNangoAdminRequest(request("/api/admin/payments/connections", "GET", auth.authorization), auth.database, env(auth.publicKey, async () => Response.json({ connections: [
    { connection_id: "owned", provider_config_key: "paypal-sandbox", tags: { end_user_id: "owner@example.com", organization_id: "org-1" } },
    { connection_id: "other-org", provider_config_key: "paypal-sandbox", tags: { end_user_id: "owner@example.com", organization_id: "org-2" } },
    { connection_id: "other-user", provider_config_key: "paypal-sandbox", tags: { end_user_id: "other@example.com", organization_id: "org-1" } },
  ] })), "payment");
  assert.equal(response.status, 200);
  const payload = await response.json() as { data: Array<{ nango_connection_id: string }> };
  assert.deepEqual(payload.data.map((row) => row.nango_connection_id), ["owned"]);
});

test("connecting a Nango ID with mismatched ownership never persists it", async () => {
  const auth = await bearer();
  let writes = 0;
  const database: WorkerDatabaseClient = { ...auth.database, async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
    if (sql.startsWith("INSERT INTO public.payment_nango_connections")) writes += 1;
    return auth.database.query<T>(sql, values);
  } };
  const response = await handleNangoAdminRequest(request("/api/admin/payments/connections", "POST", auth.authorization, { provider_config_key: "paypal-sandbox", connection_id: "stolen" }), database, env(auth.publicKey, async () => Response.json({ data: { connection_id: "stolen", provider_config_key: "paypal-sandbox", tags: { end_user_id: "victim@example.com", organization_id: "victim-org" } } })), "payment");
  assert.equal(response.status, 409);
  assert.equal(writes, 0);
});

test("Nango mutation requires an idempotency key before provider access", async () => {
  const auth = await bearer();
  const response = await handleNangoAdminRequest(request("/api/admin/payments/connect-session", "POST", auth.authorization, { integration_id: "paypal-sandbox" }, ""), auth.database, env(auth.publicKey, async () => { throw new Error("must not reach provider"); }), "payment");
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { error: string }).error, "invalid_idempotency_key");
});

test("Nango connect-session replays the persisted result for the same scoped key", async () => {
  const auth = await bearer();
  let providerCalls = 0;
  const makeRequest = () => request("/api/admin/payments/connect-session", "POST", auth.authorization, { integration_id: "paypal-sandbox" }, "same-connect-attempt");
  const remote = async () => { providerCalls += 1; return Response.json({ data: { token: "same-short-lived-token" } }); };
  const first = await handleNangoAdminRequest(makeRequest(), auth.database, env(auth.publicKey, remote), "payment");
  const replay = await handleNangoAdminRequest(makeRequest(), auth.database, env(auth.publicKey, remote), "payment");
  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  assert.deepEqual(await replay.json(), await first.json());
  assert.equal(providerCalls, 1);
});

test("Nango rejects reuse of a scoped idempotency key for a different request", async () => {
  const auth = await bearer();
  const remote = async () => Response.json({ data: { token: "connect-token" } });
  const first = await handleNangoAdminRequest(request("/api/admin/payments/connect-session", "POST", auth.authorization, { integration_id: "paypal-sandbox" }, "reused-key"), auth.database, env(auth.publicKey, remote), "payment");
  const conflict = await handleNangoAdminRequest(request("/api/admin/payments/connect-session", "POST", auth.authorization, { provider_config_key: "paypal-sandbox" }, "reused-key"), auth.database, env(auth.publicKey, remote), "payment");
  assert.equal(first.status, 200);
  assert.equal(conflict.status, 409);
});

test("payment reconnect creates a Nango reconnect session only after verifying ownership", async () => {
  const auth = await bearer();
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const response = await handleNangoAdminRequest(
    request("/api/admin/payments/connections/reconnect", "POST", auth.authorization, {
      provider_config_key: "paypal-sandbox",
      nango_connection_id: "owned-connection",
    }),
    auth.database,
    env(auth.publicKey, async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, body });
      if (url.includes("/connections/owned-connection?")) {
        return Response.json({ data: {
          connection_id: "owned-connection",
          provider_config_key: "paypal-sandbox",
          tags: { end_user_id: "owner@example.com", organization_id: "org-1" },
        } });
      }
      if (url.endsWith("/connect/sessions/reconnect")) return Response.json({ data: { token: "reconnect-token" } });
      throw new Error("unexpected Nango request: " + url);
    }),
    "payment",
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { session_token: "reconnect-token" } });
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST"]);
  assert.deepEqual(calls[1].body, { connection_id: "owned-connection", integration_id: "paypal-sandbox" });
});

test("CRM disconnect deactivates the tenant-owned CRM projection after provider deletion", async () => {
  const auth = await bearer();
  let crmProjectionDeactivated = false;
  const database: WorkerDatabaseClient = {
    ...auth.database,
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      if (sql.includes("UPDATE public.crm_nango_connections SET active = false")) {
        crmProjectionDeactivated = values[0] === "org-1" && values[1] === "owner@example.com" &&
          values[2] === "hubspot" && values[3] === "crm-connection";
      }
      return auth.database.query<T>(sql, values);
    },
  };
  const calls: string[] = [];
  const response = await handleNangoAdminRequest(
    request("/api/admin/crm/nango", "DELETE", auth.authorization, {
      provider_config_key: "hubspot",
      nango_connection_id: "crm-connection",
    }),
    database,
    env(auth.publicKey, async (input, init) => {
      const url = String(input);
      calls.push((init?.method ?? "GET") + " " + url);
      if ((init?.method ?? "GET") === "GET") return Response.json({ data: {
        connection_id: "crm-connection",
        provider_config_key: "hubspot",
        tags: { end_user_id: "owner@example.com", organization_id: "org-1" },
      } });
      return Response.json({ data: { deleted: true } });
    }),
    "crm",
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { disconnected: true } });
  assert.equal(calls.length, 2);
  assert.equal(crmProjectionDeactivated, true);
});

test("staff without required grants and non-owner cannot connect a provider", async () => {
  const staff = await bearer("staff@example.com", "staff", "owner", []);
  const deniedPermission = await handleNangoAdminRequest(request("/api/admin/payments/connect-session", "POST", staff.authorization, { integration_id: "paypal-sandbox" }), staff.database, env(staff.publicKey, async () => { throw new Error("must not reach provider"); }), "payment");
  assert.equal(deniedPermission.status, 403);

  const manager = await bearer("manager@example.com", "admin", "manager");
  const deniedOwner = await handleNangoAdminRequest(request("/api/admin/payments/connect-session", "POST", manager.authorization, { integration_id: "paypal-sandbox" }), manager.database, env(manager.publicKey, async () => { throw new Error("must not reach provider"); }), "payment");
  assert.equal(deniedOwner.status, 403);
});

test("Stripe connection is rejected for Philippines merchant availability policy", async () => {
  const auth = await bearer();
  const response = await handleNangoAdminRequest(request("/api/admin/payments/connect-session", "POST", auth.authorization, { integration_id: "stripe" }), auth.database, env(auth.publicKey, async () => { throw new Error("must not reach provider"); }), "payment");
  assert.equal(response.status, 409);
  assert.equal((await response.json() as { error: string }).error, "STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY");
});
