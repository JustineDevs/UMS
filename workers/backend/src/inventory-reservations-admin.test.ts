import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import {
  handleInventoryReservationCollectionRequest,
  handleInventoryReservationMutationRequest,
} from "./inventory-reservations-admin.ts";

function b64(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function token(claims: Record<string, unknown>): Promise<string> {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "staff-1", exp: 2_000_000_000, ...claims });
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput)));
  return `${signingInput}.${btoa(String.fromCharCode(...signature)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}

const reservationId = "8c4b85ee-4a78-4b9f-a41f-15a69df3221a";
const reservationRow = {
  id: reservationId,
  tenant_id: "org-a",
  location_id: "loc_text_1",
  inventory_item_id: "iitem_1",
  quantity: 2,
  status: "active",
  reference_type: "manual",
  reference_id: "ref-1",
  medusa_reservation_id: null,
  reserved_at: "2026-09-20T10:00:00.000Z",
  released_at: null,
  committed_at: null,
  expires_at: "2026-09-20T10:15:00.000Z",
  expired_at: null,
  reconciliation_status: "pending",
};

function workerRequest(path: string, method: string, claims: Record<string, unknown>, body?: unknown, extraHeaders: Record<string, string> = {}) {
  return token(claims).then((bearer) => new Request(`https://worker.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

test("reservation mutation rejects a staff token without inventory permission", async () => {
  const bearer = await token({ organization_id: "org-a", permissions: ["content:write"] });
  const response = await handleInventoryReservationMutationRequest(
    new Request(`https://worker.test/api/admin/inventory/reservations/${reservationId}`, { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "reserve-key-1" }, body: JSON.stringify({ operation: "release" }) }),
    { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} },
    { JWT_SECRET: "test-secret" },
    reservationId,
  );
  assert.equal(response.status, 403);
});

test("reservation mutation executes the tenant-scoped lifecycle through the Worker and persists replay", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
      if (sql.includes("inventory_reservation_lifecycle")) return { rows: [{ id: reservationId, tenant_id: "org-a", status: "released" }] as T[], rowCount: 1 };
      if (sql.includes("SET state = 'completed'")) return { rows: [] as T[], rowCount: 1 };
      throw new Error(`unexpected_query:${sql}`);
    },
    async end() {},
  };
  const bearer = await token({ organization_id: "org-a", permissions: ["inventory:write"] });
  const response = await handleInventoryReservationMutationRequest(
    new Request(`https://worker.test/api/admin/inventory/reservations/${reservationId}`, { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "reserve-key-2", "Content-Type": "application/json" }, body: JSON.stringify({ operation: "release" }) }),
    database,
    { JWT_SECRET: "test-secret" },
    reservationId,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { data: { tenantId: string } }).data.tenantId, "org-a");
  const lifecycle = calls.find((call) => call.sql.includes("inventory_reservation_lifecycle"));
  assert.deepEqual(lifecycle?.values, ["release", "org-a", "reserve-key-2", reservationId, null]);
  assert.equal(calls.some((call) => call.sql.includes("SET state = 'completed'")), true);
});

test("reservation mutation rejects unknown payload fields and invalid ids", async () => {
  const bearer = await token({ organization_id: "org-a", permissions: ["inventory:write"] });
  const database = { query: async () => { throw new Error("database must not be reached"); }, end: async () => {} } as unknown as WorkerDatabaseClient;
  const headers = { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "reserve-key-3", "Content-Type": "application/json" };
  const badId = await handleInventoryReservationMutationRequest(new Request("https://worker.test/api/admin/inventory/reservations/nope", { method: "POST", headers, body: JSON.stringify({ operation: "release" }) }), database, { JWT_SECRET: "test-secret" }, "nope");
  assert.equal(badId.status, 400);
  const extraField = await handleInventoryReservationMutationRequest(new Request(`https://worker.test/api/admin/inventory/reservations/${reservationId}`, { method: "POST", headers, body: JSON.stringify({ operation: "release", tenantId: "other-tenant" }) }), database, { JWT_SECRET: "test-secret" }, reservationId);
  assert.equal(extraField.status, 400);
});

test("reservation collection requires an authenticated tenant and read permission", async () => {
  const database = { query: async () => { throw new Error("database must not be reached"); }, end: async () => {} } as unknown as WorkerDatabaseClient;
  const noTenant = await workerRequest("/api/admin/inventory/reservations", "GET", { permissions: ["inventory:read"] });
  assert.equal((await handleInventoryReservationCollectionRequest(noTenant, database, undefined, { JWT_SECRET: "test-secret" })).status, 403);
  const noPermission = await workerRequest("/api/admin/inventory/reservations", "GET", { organization_id: "org-a", permissions: ["content:read"] });
  assert.equal((await handleInventoryReservationCollectionRequest(noPermission, database, undefined, { JWT_SECRET: "test-secret" })).status, 403);
});

test("reservation collection GET scopes rows to tenant and validates filters", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      calls.push({ sql, values });
      return { rows: [reservationRow as T], rowCount: 1 };
    },
    async end() {},
  };
  const request = await workerRequest("/api/admin/inventory/reservations?limit=500&status=active&inventoryItemId=iitem_1", "GET", { organization_id: "org-a", permissions: ["inventory:read"] });
  const response = await handleInventoryReservationCollectionRequest(request, database, undefined, { JWT_SECRET: "test-secret" });
  assert.equal(response.status, 200);
  assert.match(calls[0]?.sql ?? "", /WHERE tenant_id = \$1/);
  assert.deepEqual(calls[0]?.values, ["org-a", "active", "iitem_1", 200]);
  assert.equal((await response.json() as { organizationId: string }).organizationId, "org-a");

  const badStatus = await workerRequest("/api/admin/inventory/reservations?status=other-tenant", "GET", { organization_id: "org-a", permissions: ["inventory:read"] });
  assert.equal((await handleInventoryReservationCollectionRequest(badStatus, database, undefined, { JWT_SECRET: "test-secret" })).status, 400);
});

test("reservation collection POST uses text stock-location IDs, atomic APP writes, audit, and replay", async () => {
  const appCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const commerceCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
  let cached: { state: string; request_hash: string; response_status: number; response_headers: Array<[string, string]>; response_body: string; created_at: string } | null = null;
  const app: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      appCalls.push({ sql, values });
      if (sql.includes("INSERT INTO public.worker_idempotency_records")) {
        if (cached) return { rows: [] as T[], rowCount: 0 };
        cached = { state: "pending", request_hash: String(values[1]), response_status: 102, response_headers: [], response_body: "", created_at: new Date().toISOString() };
        return { rows: [{ state: "pending", request_hash: values[1] } as T], rowCount: 1 };
      }
      if (sql.includes("FROM public.worker_idempotency_records WHERE idempotency_key")) {
        return { rows: (cached ? [{ idempotency_key: values[0], ...cached }] : []) as T[], rowCount: cached ? 1 : 0 };
      }
      if (sql.includes("SET state = 'completed'")) {
        assert.ok(cached);
        cached = { ...cached, state: "completed", response_status: Number(values[2]), response_headers: JSON.parse(String(values[3])) as Array<[string, string]>, response_body: String(values[4]), created_at: new Date(Number(values[5])).toISOString() };
        return { rows: [] as T[], rowCount: 1 };
      }
      if (sql.includes("inventory_reservation_lifecycle('reserve'")) return { rows: [reservationRow as T], rowCount: 1 };
      if (sql.includes("inventory_reservation_set_expiry")) return { rows: [{ ...reservationRow, expires_at: "2026-09-20T10:15:00.000Z" } as T], rowCount: 1 };
      if (sql.includes("INSERT INTO public.audit_logs")) return { rows: [] as T[], rowCount: 1 };
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] as T[], rowCount: 0 };
      throw new Error(`unexpected_app_query:${sql}`);
    },
    async end() {},
  };
  const commerce: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      commerceCalls.push({ sql, values });
      return { rows: [{ location_id: "loc_text_1", stocked_quantity: 10, reserved_quantity: 3 } as T], rowCount: 1 };
    },
    async end() {},
  };
  const claims = { organization_id: "org-a", permissions: ["inventory:write"] };
  const request = () => workerRequest("/api/admin/inventory/reservations", "POST", claims, { locationId: "loc_text_1", inventoryItemId: "iitem_1", quantity: 2, referenceType: "manual", referenceId: "ref-1" }, { "Idempotency-Key": "reservation-create-1" });
  const first = await handleInventoryReservationCollectionRequest(await request(), app, commerce, { JWT_SECRET: "test-secret" });
  assert.equal(first.status, 201);
  assert.deepEqual(await first.json(), { data: {
    id: reservationId, tenantId: "org-a", locationId: "loc_text_1", inventoryItemId: "iitem_1", quantity: 2, status: "active",
    referenceType: "manual", referenceId: "ref-1", medusaReservationId: null, reservedAt: reservationRow.reserved_at,
    releasedAt: null, committedAt: null, expiresAt: "2026-09-20T10:15:00.000Z", expiredAt: null, reconciliationStatus: "pending",
  } });
  assert.match(commerceCalls[0]?.sql ?? "", /location\.id::text = CASE/);
  assert.doesNotMatch(commerceCalls[0]?.sql ?? "", /\$1::uuid/);
  assert.deepEqual(commerceCalls[0]?.values, ["loc_text_1", "iitem_1", "org-a"]);
  assert.equal(appCalls.some(({ sql }) => sql.includes("INSERT INTO public.audit_logs")), true);
  assert.equal(appCalls.some(({ sql }) => sql === "COMMIT"), true);

  const replay = await handleInventoryReservationCollectionRequest(await request(), app, commerce, { JWT_SECRET: "test-secret" });
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  assert.equal(commerceCalls.length, 1);
});

test("reservation collection rejects oversized UTF-8 bodies and unavailable commerce DB", async () => {
  const app: WorkerDatabaseClient = { query: async () => ({ rows: [], rowCount: 0 }), end: async () => {} };
  const claims = { organization_id: "org-a", permissions: ["inventory:write"] };
  const bearer = await token(claims);
  const oversized = new Request("https://worker.test/api/admin/inventory/reservations", {
    method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Idempotency-Key": "reservation-create-2" },
    body: `"${"é".repeat(33_000)}"`,
  });
  assert.equal((await handleInventoryReservationCollectionRequest(oversized, app, undefined, { JWT_SECRET: "test-secret" })).status, 413);

  const withoutCommerce = await workerRequest("/api/admin/inventory/reservations", "POST", claims, { inventoryItemId: "iitem_1", quantity: 1 }, { "Idempotency-Key": "reservation-create-3" });
  assert.equal((await handleInventoryReservationCollectionRequest(withoutCommerce, app, undefined, { JWT_SECRET: "test-secret" })).status, 503);
});

test("reservation collection distinguishes missing tenant inventory from a missing stock location", async () => {
  const claims = { organization_id: "org-a", permissions: ["inventory:write"] };
  const request = (key: string) => workerRequest("/api/admin/inventory/reservations", "POST", claims, { inventoryItemId: "iitem_1", quantity: 1 }, { "Idempotency-Key": key });
  const app: WorkerDatabaseClient = {
    query: async <T extends Record<string, unknown>>(sql: string) => ({
      rows: sql.includes("INSERT INTO public.worker_idempotency_records") ? [{ state: "pending", request_hash: "hash" } as T] : [],
      rowCount: sql.includes("INSERT INTO public.worker_idempotency_records") || sql.includes("SET state = 'completed'") ? 1 : 0,
    }),
    end: async () => {},
  };
  const noLocation: WorkerDatabaseClient = {
    query: async <T extends Record<string, unknown>>() => ({ rows: [{ location_id: null, stocked_quantity: 0, reserved_quantity: 0 } as T], rowCount: 1 }),
    end: async () => {},
  };
  const missingItem: WorkerDatabaseClient = { query: async <T extends Record<string, unknown>>() => ({ rows: [] as T[], rowCount: 0 }), end: async () => {} };
  const locationResponse = await handleInventoryReservationCollectionRequest(await request("reservation-create-5"), app, noLocation, { JWT_SECRET: "test-secret" });
  assert.equal(locationResponse.status, 409);
  assert.equal((await locationResponse.json() as { error: string }).error, "no_active_stock_location");
  const itemResponse = await handleInventoryReservationCollectionRequest(await request("reservation-create-6"), app, missingItem, { JWT_SECRET: "test-secret" });
  assert.equal(itemResponse.status, 404);
  assert.equal((await itemResponse.json() as { error: string }).error, "inventory_item_not_found");
});

test("reservation collection rolls back and releases the idempotency claim after APP persistence failure", async () => {
  const calls: string[] = [];
  const app: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string) {
      calls.push(sql);
      if (sql.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "hash" } as T], rowCount: 1 };
      if (sql.includes("inventory_reservation_lifecycle('reserve'")) return { rows: [reservationRow as T], rowCount: 1 };
      if (sql.includes("inventory_reservation_set_expiry")) return { rows: [] as T[], rowCount: 0 };
      if (["BEGIN", "ROLLBACK"].includes(sql)) return { rows: [] as T[], rowCount: 0 };
      if (sql.includes("DELETE FROM public.worker_idempotency_records")) return { rows: [] as T[], rowCount: 1 };
      throw new Error(`unexpected_app_query:${sql}`);
    },
    async end() {},
  };
  const commerce: WorkerDatabaseClient = { query: async <T extends Record<string, unknown>>() => ({ rows: [{ location_id: "loc_text_1", stocked_quantity: 10, reserved_quantity: 0 } as T], rowCount: 1 }), end: async () => {} };
  const request = await workerRequest("/api/admin/inventory/reservations", "POST", { organization_id: "org-a", permissions: ["inventory:write"] }, { inventoryItemId: "iitem_1", quantity: 1 }, { "Idempotency-Key": "reservation-create-4" });
  const response = await handleInventoryReservationCollectionRequest(request, app, commerce, { JWT_SECRET: "test-secret" });
  assert.equal(response.status, 503);
  assert.equal(calls.includes("ROLLBACK"), true);
  assert.equal(calls.some((sql) => sql.includes("DELETE FROM public.worker_idempotency_records")), true);
  assert.equal(calls.includes("COMMIT"), false);
});
