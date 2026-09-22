import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleBulkFulfillmentRequest } from "./fulfillment-admin.ts";
import type { WorkerDatabaseClient } from "./database.ts";

const secret = "test-secret";
function encode(value: unknown): string { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function staffToken(organizationId = "org_1"): string {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", email: "staff@example.com", role: "admin", organization_id: organizationId, exp: Math.floor(Date.now() / 1000) + 300 });
  return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`;
}

function databases(options: { failShipmentInsert?: boolean; failQueueSend?: boolean; orderEmail?: string | null; orderOrganization?: string; noShippingOption?: boolean; noStockLocation?: boolean; managedInventory?: boolean; inventoryReservation?: boolean } = {}) {
  const orders = new Map<string, { status: string; fulfillmentStatus: string; displayId: number; email: string | null; organizationId: string; version: number }>([
    ["order_1", { status: "pending", fulfillmentStatus: "not_fulfilled", displayId: 17, email: options.orderEmail === undefined ? "buyer@example.com" : options.orderEmail, organizationId: options.orderOrganization ?? "org_1", version: 1 }],
  ]);
  const orderItems = new Map([["order_1", [
    { id: "snapshot_1", item_id: "line_1", quantity: 3, fulfilled: 1 },
    { id: "snapshot_2", item_id: "line_2", quantity: 2, fulfilled: 0 },
    { id: "snapshot_3", item_id: "line_3", quantity: 1, fulfilled: 1 },
  ]]]);
  const shipments = new Map<string, unknown>();
  const deliveryAttempts = new Map<string, { id: string; status: string; recipient: string }>();
  const audits: unknown[] = [];
  const jobs: unknown[] = [];
  const auditKeys = new Set<string>();
  const idempotency = new Map<string, { requestHash: string; state: string; status?: number; headers?: Array<[string, string]>; body?: string; createdAt?: string }>();
  let failShipmentInsert = options.failShipmentInsert ?? false;
  let failQueueSend = options.failQueueSend ?? false;
  let fulfillmentUpdateCount = 0;
  let inventoryUpdateCount = 0;
  const canonical = { addresses: 0, fulfillments: 0, items: 0, links: 0, changes: 0, actions: 0, summaries: 0, snapshots: 0 };
  const versionedItems: Array<{ lineItemId: string; fulfilledQuantity: number }> = [];

  const app: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
    if (sql.includes("INSERT INTO public.worker_idempotency_records")) {
      const key = String(values[0]); const requestHash = String(values[1]);
      if (idempotency.has(key)) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
      idempotency.set(key, { requestHash, state: "pending" });
      return { rows: [{ state: "pending", request_hash: requestHash }] as unknown as T[], rowCount: 1 };
    }
    if (sql.includes("SELECT idempotency_key, request_hash, state")) {
      const key = String(values[0]); const record = idempotency.get(key);
      return { rows: record ? [{ idempotency_key: key, request_hash: record.requestHash, state: record.state, response_status: record.status, response_headers: record.headers, response_body: record.body, created_at: record.createdAt }] as unknown as T[] : [], rowCount: record ? 1 : 0 };
    }
    if (sql.includes("UPDATE public.worker_idempotency_records")) {
      const key = String(values[0]); const record = idempotency.get(key);
      if (record) Object.assign(record, { state: "completed", status: values[2], headers: JSON.parse(String(values[3])), body: String(values[4]), createdAt: new Date(Number(values[5])).toISOString() });
      return { rows: [], rowCount: record ? 1 : 0 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes("DELETE FROM public.worker_idempotency_records")) {
      idempotency.delete(String(values[0]));
      return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes("INSERT INTO public.public_delivery_attempts")) {
      const key = String(values[3]);
      if (deliveryAttempts.has(key)) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
      const attempt = { id: "00000000-0000-4000-8000-000000000020", status: "queued", recipient: String(values[2]) };
      deliveryAttempts.set(key, attempt);
      return { rows: [attempt] as unknown as T[], rowCount: 1 };
    }
    if (sql.includes("SELECT id,status FROM public.public_delivery_attempts")) {
      const attempt = deliveryAttempts.get(String(values[0]));
      return { rows: attempt ? [attempt] as unknown as T[] : [], rowCount: attempt ? 1 : 0 };
    }
    if (sql.includes("INSERT INTO public.delivery_logistics_shipments")) {
      if (failShipmentInsert) { failShipmentInsert = false; throw new Error("app database temporarily unavailable"); }
      const orderId = String(values[1]);
      if (shipments.has(orderId)) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
      shipments.set(orderId, { trackingUrl: null, providerShipmentId: null, trackingNumber: values[5] && JSON.parse(String(values[5])).tracking_number });
      return { rows: [{ id: `shipment:${orderId}` }] as unknown as T[], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO public.audit_logs")) {
      const details = JSON.parse(String(values[2])) as { idempotency_key: string };
      if (!auditKeys.has(details.idempotency_key)) {
        auditKeys.add(details.idempotency_key);
        audits.push(details);
      }
      return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    throw new Error(`unexpected APP SQL: ${sql}`);
  }, async end() {} };

  const commerce: WorkerDatabaseClient = { async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
    const orderId = String(values[0]); const order = orders.get(orderId);
    if (sql.includes("SELECT id,display_id,email,status,fulfillment_status,version,shipping_address_id")) {
      const scoped = order?.organizationId === String(values[1]) ? order : undefined;
      return { rows: scoped ? [{ id: orderId, display_id: scoped.displayId, email: scoped.email, status: scoped.status, fulfillment_status: scoped.fulfillmentStatus, version: scoped.version, shipping_address_id: "address_1" }] as unknown as T[] : [], rowCount: scoped ? 1 : 0 };
    }
    if (sql.includes("SELECT oi.id,oi.item_id,oi.quantity,oi.fulfilled_quantity")) {
      const rows = orderItems.get(orderId) ?? [];
      return { rows: rows.map((item) => ({ id: item.id, item_id: item.item_id, quantity: item.quantity, fulfilled_quantity: item.fulfilled, title: item.item_id, variant_title: null, variant_sku: null, variant_barcode: null, variant_id: options.managedInventory && item.item_id === "line_1" ? "variant_1" : null, requires_shipping: true, manage_inventory: options.managedInventory === true && item.item_id === "line_1" })) as unknown as T[], rowCount: rows.length };
    }
    if (sql.includes("FROM public.order_shipping os")) {
      if (options.noShippingOption) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
      return { rows: [{ shipping_option_id: "so_1", provider_id: "manual_manual", location_id: options.noStockLocation ? null : "sloc_1", data: {} }] as unknown as T[], rowCount: 1 };
    }
    if (sql.includes("FROM public.reservation_item ri")) {
      if (options.inventoryReservation) return { rows: [{ id: "reservation_1", line_item_id: "line_1", inventory_item_id: "inv_1", location_id: "sloc_1", quantity: 2, required_quantity: 1, title: "Canary stock", sku: "CANARY" }] as unknown as T[], rowCount: 1 };
      return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes("UPDATE public.inventory_level")) { inventoryUpdateCount += 1; return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; }
    if (sql.includes("UPDATE public.reservation_item")) return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    if (sql.includes("INSERT INTO public.fulfillment_address")) { canonical.addresses += 1; return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; }
    if (sql.includes("INSERT INTO public.fulfillment_item")) { canonical.items += 1; return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; }
    if (sql.includes("INSERT INTO public.fulfillment\n")) { canonical.fulfillments += 1; return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; }
    if (sql.includes("INSERT INTO public.order_fulfillment")) { canonical.links += 1; return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; }
    if (sql.includes("INSERT INTO public.order_change_action")) {
      if (Number(values[6]) > 0) canonical.actions += 1;
      return { rows: [], rowCount: Number(values[6]) > 0 ? 1 : 0 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes("INSERT INTO public.order_change\n")) { canonical.changes += 1; return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; }
    if (sql.includes("INSERT INTO public.order_item\n")) {
      const item = orderItems.get(orderId)?.find((candidate) => candidate.item_id === String(values[1]));
      if (!item) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
      item.fulfilled += Number(values[4]);
      versionedItems.push({ lineItemId: item.item_id, fulfilledQuantity: item.fulfilled });
      canonical.snapshots += 1;
      return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes("INSERT INTO public.order_summary")) { canonical.summaries += 1; return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number }; }
    if (sql.includes("UPDATE public.order_change SET updated_at")) return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    if (/UPDATE public\."order"/.test(sql)) {
      if (!order || ["fulfilled", "shipped", "delivered"].includes(order.fulfillmentStatus)) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
      order.fulfillmentStatus = "fulfilled";
      order.version = Number(values[1]);
      fulfillmentUpdateCount += 1;
      return { rows: [{ id: orderId, fulfillment_status: "fulfilled" }] as unknown as T[], rowCount: 1 };
    }
    throw new Error(`unexpected commerce SQL: ${sql}`);
  }, async end() {} };

  return {
    app, commerce, orders, orderItems, shipments, deliveryAttempts, audits, jobs, canonical, versionedItems,
    env: { JWT_SECRET: secret, COMMERCE_QUEUE: { async send(job: unknown) {
      if (failQueueSend) { failQueueSend = false; throw new Error("queue temporarily unavailable"); }
      jobs.push(job);
    } } },
    get fulfillmentUpdateCount() { return fulfillmentUpdateCount; },
    get inventoryUpdateCount() { return inventoryUpdateCount; },
  };
}

function request(body: unknown, key = "fulfill-1", organizationId = "org_1") {
  return new Request("https://worker.test/api/admin/orders/bulk-fulfill", {
    method: "POST",
    headers: { Authorization: `Bearer ${staffToken(organizationId)}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

test("bulk fulfillment requires a verified staff bearer token", async () => {
  const response = await handleBulkFulfillmentRequest(
    new Request("https://worker.test/api/admin/orders/bulk-fulfill", { method: "POST", headers: { "Idempotency-Key": "fulfill-1" }, body: JSON.stringify({ orderIds: ["order_1"] }) }),
    { query: async () => ({ rows: [], rowCount: 0 }) } as never,
    { query: async () => ({ rows: [], rowCount: 0 }) } as never,
    { JWT_SECRET: "test" },
  );
  assert.equal(response.status, 403);
});

test("bulk fulfillment rejects duplicate or silently-invalid order IDs", async () => {
  const db = databases();
  const duplicate = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1", "order_1"] }), db.commerce, db.app, db.env);
  const invalid = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1", "bad/id"] }), db.commerce, db.app, db.env);
  assert.equal(duplicate.status, 400);
  assert.equal(invalid.status, 400);
  assert.equal(db.orders.get("order_1")?.fulfillmentStatus, "not_fulfilled");
});

test("bulk fulfillment rejects oversized, unknown, and wrongly typed fields before database writes", async () => {
  const db = databases();
  const oversized = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], trackingNumber: "x".repeat(65 * 1024) }), db.commerce, db.app, db.env);
  const unknown = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], providerSecret: "must-not-be-ignored" }), db.commerce, db.app, db.env);
  const invalidNotify = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], notifyCustomer: "false" }), db.commerce, db.app, db.env);
  assert.equal(oversized.status, 413);
  assert.equal(unknown.status, 400);
  assert.equal(invalidNotify.status, 400);
  assert.equal(db.fulfillmentUpdateCount, 0);
  assert.equal(db.shipments.size, 0);
});

test("orders without a customer email are not fulfilled before the required shipment row can be written", async () => {
  const db = databases({ orderEmail: null });
  const response = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"] }), db.commerce, db.app, db.env);
  const payload = await response.json() as { failed: number; results: Array<{ ok: boolean; error?: string }> };
  assert.equal(response.status, 200);
  assert.equal(payload.failed, 1);
  assert.equal(payload.results[0]?.error, "order_customer_email_missing");
  assert.equal(db.fulfillmentUpdateCount, 0);
  assert.equal(db.orders.get("order_1")?.fulfillmentStatus, "not_fulfilled");
  assert.equal(db.shipments.size, 0);
});

test("bulk fulfillment enforces tenant ownership before reading or mutating item rows", async () => {
  const db = databases();
  const response = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"] }, "tenant-check", "org_other"), db.commerce, db.app, db.env);
  const payload = await response.json() as { failed: number; results: Array<{ error?: string }> };
  assert.equal(payload.failed, 1);
  assert.equal(payload.results[0]?.error, "order_not_found");
  assert.equal(db.orders.get("order_1")?.fulfillmentStatus, "not_fulfilled");
  assert.deepEqual(db.orderItems.get("order_1")?.map(({ fulfilled }) => fulfilled), [1, 0, 1]);
});

test("canceled orders cannot be fulfilled", async () => {
  const db = databases();
  db.orders.get("order_1")!.status = "canceled";
  const response = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"] }), db.commerce, db.app, db.env);
  const payload = await response.json() as { failed: number; results: Array<{ ok: boolean; error?: string }> };
  assert.equal(response.status, 200);
  assert.equal(payload.failed, 1);
  assert.deepEqual(payload.results[0], { orderId: "order_1", ok: false, error: "order_cancelled" });
  assert.equal(db.fulfillmentUpdateCount, 0);
  assert.deepEqual(db.orderItems.get("order_1")?.map(({ fulfilled }) => fulfilled), [1, 0, 1]);
});

test("fulfillment completes only outstanding line quantities and sends one durable notification", async () => {
  const db = databases();
  const input = { orderIds: ["order_1"], trackingNumber: "TRACK-1", carrierId: "jtexpress" };
  const response = await handleBulkFulfillmentRequest(request(input), db.commerce, db.app, db.env);
  const payload = await response.json() as { succeeded: number; failed: number };
  assert.equal(response.status, 200);
  assert.equal(payload.succeeded, 1, JSON.stringify(payload));
  assert.equal(payload.failed, 0);
  assert.deepEqual(db.orderItems.get("order_1")?.map(({ fulfilled }) => fulfilled), [3, 2, 1]);
  assert.deepEqual(db.versionedItems, [
    { lineItemId: "line_1", fulfilledQuantity: 3 },
    { lineItemId: "line_2", fulfilledQuantity: 2 },
    { lineItemId: "line_3", fulfilledQuantity: 1 },
  ]);
  assert.deepEqual(db.canonical, { addresses: 1, fulfillments: 1, items: 2, links: 1, changes: 1, actions: 2, summaries: 1, snapshots: 3 });
  assert.equal(db.orders.get("order_1")?.version, 2);
  assert.equal(db.shipments.size, 1);
  assert.equal(db.jobs.length, 1);
  assert.equal(db.deliveryAttempts.size, 1);
  const job = db.jobs[0] as { name: string; payload: { recipient: string; html: string } };
  assert.equal(job.name, "notification-delivery");
  assert.equal(job.payload.recipient, "buyer@example.com");
  assert.match(job.payload.html, /TRACK-1/);

  const replay = await handleBulkFulfillmentRequest(request(input), db.commerce, db.app, db.env);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  assert.deepEqual(db.orderItems.get("order_1")?.map(({ fulfilled }) => fulfilled), [3, 2, 1]);
  assert.equal(db.jobs.length, 1);
  assert.equal(db.canonical.fulfillments, 1);
});

test("fulfillment without a tracking number creates no logistics shipment and honors notification opt-out", async () => {
  const db = databases();
  const response = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], notifyCustomer: false }), db.commerce, db.app, db.env);
  assert.equal(response.status, 200);
  assert.equal(db.orders.get("order_1")?.fulfillmentStatus, "fulfilled");
  assert.equal(db.shipments.size, 0);
  assert.equal(db.deliveryAttempts.size, 0);
  assert.equal(db.jobs.length, 0);
});

test("fulfillment fails closed when shipping configuration or its stock location is missing", async () => {
  for (const [options, expectedError] of [
    [{ noShippingOption: true }, "order_shipping_option_missing"],
    [{ noStockLocation: true }, "shipping_option_stock_location_missing"],
  ] as const) {
    const db = databases(options);
    const response = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], notifyCustomer: false }), db.commerce, db.app, db.env);
    const payload = await response.json() as { failed: number; results: Array<{ error?: string }> };
    assert.equal(payload.failed, 1);
    assert.equal(payload.results[0]?.error, expectedError);
    assert.equal(db.canonical.fulfillments, 0);
    assert.equal(db.orders.get("order_1")?.version, 1);
  }
});

test("managed stock requires a reservation and consumes inventory and reservation in the commerce transaction", async () => {
  const missing = databases({ managedInventory: true });
  const rejected = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], notifyCustomer: false }), missing.commerce, missing.app, missing.env);
  assert.equal((await rejected.json() as { results: Array<{ error?: string }> }).results[0]?.error, "inventory_reservation_missing");
  assert.equal(missing.inventoryUpdateCount, 0);
  assert.equal(missing.canonical.fulfillments, 0);

  const reserved = databases({ managedInventory: true, inventoryReservation: true });
  const fulfilled = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], notifyCustomer: false }), reserved.commerce, reserved.app, reserved.env);
  const payload = await fulfilled.json() as { succeeded: number; results: unknown[] };
  assert.equal(payload.succeeded, 1, JSON.stringify(payload));
  assert.equal(reserved.inventoryUpdateCount, 1);
  assert.equal(reserved.canonical.items, 2);
});

test("customer notification requires the real queue binding before any fulfillment mutation", async () => {
  const db = databases();
  const { COMMERCE_QUEUE: _queue, ...env } = db.env;
  const response = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"] }), db.commerce, db.app, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { error: string }).error, "notification_queue_unavailable");
  assert.equal(db.orders.get("order_1")?.fulfillmentStatus, "not_fulfilled");
  assert.deepEqual(db.orderItems.get("order_1")?.map(({ fulfilled }) => fulfilled), [1, 0, 1]);
});

test("retry repairs a commerce fulfillment whose APP shipment write previously failed", async () => {
  const db = databases({ failShipmentInsert: true });
  await assert.rejects(() => handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], trackingNumber: "TRACK-1", carrierId: "jtexpress" }), db.commerce, db.app, db.env));
  assert.equal(db.orders.get("order_1")?.fulfillmentStatus, "fulfilled");
  assert.equal(db.shipments.size, 0);

  const retry = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], trackingNumber: "TRACK-1", carrierId: "jtexpress" }), db.commerce, db.app, db.env);
  const payload = await retry.json() as { succeeded: number; skipped: number; failed: number };
  assert.equal(retry.status, 200);
  assert.deepEqual(payload, { total: 1, succeeded: 0, skipped: 1, failed: 0, results: [{ orderId: "order_1", ok: true, skipped: true, fulfillment_status: "fulfilled", displayId: 17, email: "buyer@example.com" }] });
  assert.equal(db.shipments.size, 1);
  assert.equal(db.audits.length, 1);
});

test("queue outage leaves a durable notification attempt and retry enqueues without repeating fulfillment", async () => {
  const db = databases({ failQueueSend: true });
  const input = { orderIds: ["order_1"], trackingNumber: "TRACK-1", carrierId: "jtexpress" };
  await assert.rejects(() => handleBulkFulfillmentRequest(request(input, "queue-retry"), db.commerce, db.app, db.env));
  assert.equal(db.orders.get("order_1")?.fulfillmentStatus, "fulfilled");
  assert.equal(db.deliveryAttempts.size, 1);
  assert.equal(db.jobs.length, 0);
  assert.equal(db.audits.length, 1);

  const retry = await handleBulkFulfillmentRequest(request(input, "queue-retry"), db.commerce, db.app, db.env);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json() as { skipped: number }).skipped, 1);
  assert.deepEqual(db.orderItems.get("order_1")?.map(({ fulfilled }) => fulfilled), [3, 2, 1]);
  assert.equal(db.jobs.length, 1);
  assert.equal(db.audits.length, 1);
});

test("bulk fulfillment is idempotently replayed and never invents provider tracking artifacts", async () => {
  const db = databases();
  const firstRequest = request({ orderIds: ["order_1"], trackingNumber: "TRACK-1", carrierId: "jtexpress" });
  const first = await handleBulkFulfillmentRequest(firstRequest, db.commerce, db.app, db.env);
  const replay = await handleBulkFulfillmentRequest(request({ orderIds: ["order_1"], trackingNumber: "TRACK-1", carrierId: "jtexpress" }), db.commerce, db.app, db.env);
  assert.equal(first.status, 200);
  assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
  assert.equal(db.shipments.size, 1);
  assert.equal(db.audits.length, 1);
  assert.deepEqual(db.shipments.get("order_1"), { trackingUrl: null, providerShipmentId: null, trackingNumber: "TRACK-1" });
});
