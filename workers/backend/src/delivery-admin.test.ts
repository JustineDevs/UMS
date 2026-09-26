import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleDeliveryShipmentsRequest } from "./delivery-admin.ts";

function token(): string { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const h = encode({ alg: "HS256", typ: "JWT" }); const p = encode({ sub: "staff_1", role: "admin", organization_id: "org_1", exp: Math.floor(Date.now() / 1000) + 300 }); return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`; }

test("delivery shipment listing requires staff authorization", async () => {
  const database = { query: async () => { throw new Error("must not query"); }, end: async () => {} };
  const response = await handleDeliveryShipmentsRequest(new Request("https://api.test/api/admin/delivery-logistics/shipments"), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 401);
});

test("delivery shipment listing scopes both shipments and events to organization", async () => {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = { query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => { calls.push({ text, values }); return { rows: [] as T[], rowCount: 0 }; }, end: async () => {} };
  const response = await handleDeliveryShipmentsRequest(new Request("https://api.test/api/admin/delivery-logistics/shipments?status=in_transit&limit=25", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200);
  assert.ok(calls.every((call) => !call.text.includes("SELECT *")));
  assert.deepEqual(calls.map((call) => call.values), [["org_1", "in_transit", 25], ["org_1", 25]]);
  assert.ok(calls.every((call) => call.text.includes("organization_id = $1")));
});

test("delivery shipment mutation uses tenant-scoped upsert and durable idempotency", async () => {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = { query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
    calls.push({ text, values });
    if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
    if (text.includes("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
    if (text.includes("INSERT INTO public.delivery_logistics_shipments")) return { rows: [{ id: "shipment-1", organization_id: "org_1", order_id: "order-1" }] as T[], rowCount: 1 };
    return { rows: [] as T[], rowCount: 0 };
  }, end: async () => {} };
  const commerce = { query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
    assert.match(text, /metadata->>'organization_id' = \$2/);
    assert.match(text, /metadata->>'store_id' = \$2/);
    assert.deepEqual(values, ["order-1", "org_1"]);
    return { rows: [{ display_id: 77, email: "buyer@example.com" }] as T[], rowCount: 1 };
  }, end: async () => {} };
  const response = await handleDeliveryShipmentsRequest(new Request("https://api.test/api/admin/delivery-logistics/shipments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "shipment-1", "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "shipment", order_id: "order-1", customer_email: "attacker@example.com" }),
  }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, commerce);
  assert.equal(response.status, 201);
  const upsert = calls.find((call) => call.text.includes("INSERT INTO public.delivery_logistics_shipments"));
  assert.ok(upsert);
  assert.match(upsert!.text, /ON CONFLICT \(organization_id,order_id\)/);
  assert.equal(upsert!.values[0], "org_1");
  assert.equal(upsert!.values[2], "77");
  assert.equal(upsert!.values[3], "buyer@example.com");
});

test("delivery shipment mutation rejects orders owned by another organization", async () => {
  const database = { query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
    if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "pending", request_hash: values[1] }] as T[], rowCount: 1 };
    if (text.includes("UPDATE public.worker_idempotency_records")) return { rows: [] as T[], rowCount: 1 };
    return { rows: [] as T[], rowCount: 0 };
  }, end: async () => {} };
  const commerce = { query: async <T extends Record<string, unknown>>() => ({ rows: [] as T[], rowCount: 0 }), end: async () => {} };
  const response = await handleDeliveryShipmentsRequest(new Request("https://api.test/api/admin/delivery-logistics/shipments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "shipment-cross-tenant", "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "shipment", order_id: "order-foreign", customer_email: "buyer@example.com" }),
  }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" }, commerce);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "order_not_found" });
});
