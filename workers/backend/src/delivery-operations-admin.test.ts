import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleAdminDeliveryOperationsRequest } from "./delivery-operations-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function token(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 });
  return `${header}.${payload}.${createHmac("sha256", "admin-secret").update(`${header}.${payload}`).digest("base64url")}`;
}

test("delivery operations GET returns the canonical tenant-scoped overview", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) { queries.push({ text, values }); return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number }; }, async end() {} };
  const response = await handleAdminDeliveryOperationsRequest(new Request("https://api.test/api/admin/delivery-logistics/operations", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret", PANCAKE_POS_API_KEY: "pancake", RESEND_API_KEY: "resend" });
  assert.equal(response.status, 200);
  const body = await response.json() as { ok: boolean; overview: { coverage: { total: number }; supportedApps: unknown[]; openExceptions: unknown[]; operationalSignals: { pancakePosConfigured: boolean; smsConfigured: boolean } } };
  assert.equal(body.ok, true);
  assert.ok(body.overview.coverage.total > 0);
  assert.ok(body.overview.supportedApps.length > 0);
  assert.deepEqual(body.overview.openExceptions, []);
  assert.deepEqual(body.overview.operationalSignals, { activeOrders: 0, shipmentDue: 0, recordedShipments: 0, recentEvents: 0, trackingLinksEnabled: false, codDeliveredPendingCapture: 0, pancakePosConfigured: true, smsConfigured: true });
  assert.equal(queries.length, 5);
  assert.ok(queries.slice(0, 4).every((query) => query.text.includes("$1")));
  assert.deepEqual(queries[0]?.values, ["org_1", 200]);
});

test("delivery operations GET derives operational signals from persisted rows", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) {
    if (text.includes("active_orders")) return { rows: [{ active_orders: "3", shipment_due: "2", recorded_shipments: "4", tracking_links: "1", cod_delivered_pending_capture: "1" }] as unknown as T[], rowCount: 1 };
    if (text.includes("delivery_logistics_shipments")) return { rows: [{ id: "shipment-1", tracking_url: "https://track.test/1" }] as unknown as T[], rowCount: 1 };
    return { rows: [] as T[], rowCount: 0 };
  }, async end() {} };
  const response = await handleAdminDeliveryOperationsRequest(new Request("https://api.test/api/admin/delivery-logistics/operations", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  const body = await response.json() as { overview: { operationalSignals: Record<string, unknown> } };
  assert.deepEqual(body.overview.operationalSignals, { activeOrders: 3, shipmentDue: 2, recordedShipments: 4, recentEvents: 0, trackingLinksEnabled: true, codDeliveredPendingCapture: 1, pancakePosConfigured: false, smsConfigured: false });
});

test("delivery operation writes require idempotency and fail closed when providers are absent", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(text: string) { if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: "claimed" }] as unknown as T[], rowCount: 1 }; if (text.includes("DELETE FROM public.worker_idempotency_records")) return { rows: [], rowCount: 1 }; throw new Error("database_should_not_be_called"); }, async end() {} };
  const base = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };
  const missing = await handleAdminDeliveryOperationsRequest(new Request("https://api.test/api/admin/delivery-logistics/operations", { method: "POST", headers: base, body: JSON.stringify({ kind: "geocode", address: "Manila" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(missing.status, 400);
  const unavailable = await handleAdminDeliveryOperationsRequest(new Request("https://api.test/api/admin/delivery-logistics/operations", { method: "POST", headers: { ...base, "Idempotency-Key": "geo-1" }, body: JSON.stringify({ kind: "geocode", address: "Manila" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(unavailable.status, 503);
});
