import assert from "node:assert/strict";
import test from "node:test";
import { finalizeNativeOrder, finalizeNativeOrderAcrossDatabases } from "./order-finalization.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function client(handler: (text: string, values: readonly unknown[]) => unknown): WorkerDatabaseClient {
  const calls: string[] = [];
  return {
    async query(text, values = []) {
      calls.push(text);
      const result = await handler(text, values);
      return result as { rows: Record<string, unknown>[]; rowCount: number };
    },
    async end() {},
    calls,
  } as WorkerDatabaseClient & { calls: string[] };
}

test("finalizes a paid cart using one transaction and links the attempt", async () => {
  const queries: string[] = [];
  const database = client((text) => {
    queries.push(text);
    if (text.includes("FROM public.payment_attempts")) return { rows: [{ correlation_id: "00000000-0000-4000-8000-000000000001", cart_id: "cart_1", provider: "stripe", amount_minor: 5997, currency: "php", provider_payment_id: "pi_test", provider_payload: {}, status: "paid", medusa_order_id: null }], rowCount: 1 };
    if (text.includes("metadata->>'worker_payment_correlation_id'")) return { rows: [], rowCount: 0 };
    if (text.includes("FROM public.cart\n")) return { rows: [{ id: "cart_1", region_id: "reg_1", customer_id: null, sales_channel_id: "sc_1", email: "buyer@example.com", currency_code: "php", shipping_address_id: null, billing_address_id: null, metadata: {} }], rowCount: 1 };
    if (text.includes("FROM public.cart_line_item")) return { rows: [{ id: "line_1", title: "Guitar", subtitle: null, thumbnail: null, quantity: 1, variant_id: "var_1", product_id: "prod_1", product_title: "Guitar", product_description: null, product_subtitle: null, product_type: null, product_collection: null, product_handle: "guitar", variant_sku: null, variant_barcode: null, variant_title: null, variant_option_values: {}, requires_shipping: true, is_discountable: true, is_tax_inclusive: false, compare_at_unit_price: null, raw_compare_at_unit_price: null, unit_price: "5997", raw_unit_price: { value: "5997" }, metadata: {}, product_type_id: null, is_custom_price: false, is_giftcard: false }], rowCount: 1 };
    return { rows: [{ id: "ok" }], rowCount: 1 };
  });
  const result = await finalizeNativeOrder(database, "00000000-0000-4000-8000-000000000001");
  assert.equal(result.replayed, false);
  assert.match(result.orderId, /^order_/);
  assert.equal(queries[0], "BEGIN");
  assert.equal(queries.at(-1), "COMMIT");
  assert.ok(queries.some((query) => query.includes("INSERT INTO public.order_line_item")));
  assert.ok(queries.some((query) => query.includes("UPDATE public.payment_attempts")));
});

test("rolls back when the payment is not settled", async () => {
  const database = client((text) => {
    if (text.includes("FROM public.payment_attempts")) return { rows: [{ correlation_id: "00000000-0000-4000-8000-000000000002", cart_id: "cart_1", status: "pending", medusa_order_id: null }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  await assert.rejects(() => finalizeNativeOrder(database, "00000000-0000-4000-8000-000000000002"), /payment_not_settled/);
});

test("split topology routes payment attempts to APP and commerce writes to Medusa", async () => {
  const appQueries: string[] = [];
  const commerceQueries: string[] = [];
  const app = client((text) => {
    appQueries.push(text);
    if (text.includes("UPDATE public.payment_attempts") && text.includes("RETURNING")) return { rows: [{ correlation_id: "00000000-0000-4000-8000-000000000003", cart_id: "cart_1", provider: "stripe", amount_minor: 5997, currency: "php", provider_payment_id: "pi_test", provider_payload: {}, status: "paid", medusa_order_id: null }], rowCount: 1 };
    if (text.includes("FROM public.payment_attempts")) return { rows: [{ correlation_id: "00000000-0000-4000-8000-000000000003", cart_id: "cart_1", provider: "stripe", amount_minor: 5997, currency: "php", provider_payment_id: "pi_test", provider_payload: {}, status: "paid", medusa_order_id: null }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const commerce = client((text) => {
    commerceQueries.push(text);
    if (text.includes("metadata->>'worker_payment_correlation_id'")) return { rows: [], rowCount: 0 };
    if (text.includes("FROM public.cart\n")) return { rows: [{ id: "cart_1", region_id: "reg_1", customer_id: null, sales_channel_id: "sc_1", email: "buyer@example.com", currency_code: "php", shipping_address_id: null, billing_address_id: null, metadata: {} }], rowCount: 1 };
    if (text.includes("FROM public.cart_line_item")) return { rows: [{ id: "line_1", title: "Guitar", subtitle: null, thumbnail: null, quantity: 1, variant_id: "var_1", product_id: "prod_1", product_title: "Guitar", product_description: null, product_subtitle: null, product_type: null, product_collection: null, product_handle: "guitar", variant_sku: null, variant_barcode: null, variant_title: null, variant_option_values: {}, requires_shipping: true, is_discountable: true, is_tax_inclusive: false, compare_at_unit_price: null, raw_compare_at_unit_price: null, unit_price: "5997", raw_unit_price: { value: "5997" }, metadata: {}, product_type_id: null, is_custom_price: false, is_giftcard: false }], rowCount: 1 };
    return { rows: [{ id: "ok" }], rowCount: 1 };
  });
  const result = await finalizeNativeOrderAcrossDatabases(app, commerce, "00000000-0000-4000-8000-000000000003");
  assert.equal(result.replayed, false);
  assert.ok(appQueries.some((query) => query.includes("FROM public.payment_attempts")));
  assert.ok(appQueries.some((query) => query.includes("UPDATE public.payment_attempts")));
  assert.ok(commerceQueries.some((query) => query.includes("INSERT INTO public.order")));
  assert.ok(commerceQueries.includes("BEGIN"));
  const claim = appQueries.find((query) => query.includes("SET checkout_state = 'finalizing'"));
  assert.match(claim ?? "", /updated_at < now\(\) - interval '10 minutes'/);
});

test("reconciles a committed commerce order before retrying the cart", async () => {
  const appQueries: string[] = [];
  const commerceQueries: string[] = [];
  const app = client((text) => {
    appQueries.push(text);
    if (text.includes("SET checkout_state = 'finalizing'")) {
      return { rows: [{ correlation_id: "00000000-0000-4000-8000-000000000004", cart_id: "cart_1", provider: "stripe", amount_minor: 5997, currency: "php", status: "paid", medusa_order_id: null }], rowCount: 1 };
    }
    if (text.includes("FROM public.payment_attempts")) {
      return { rows: [{ correlation_id: "00000000-0000-4000-8000-000000000004", cart_id: "cart_1", provider: "stripe", amount_minor: 5997, currency: "php", status: "paid", medusa_order_id: null }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const commerce = client((text) => {
    commerceQueries.push(text);
    if (text.includes("metadata->>'worker_payment_correlation_id'")) {
      return { rows: [{ id: "order_existing" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const result = await finalizeNativeOrderAcrossDatabases(
    app,
    commerce,
    "00000000-0000-4000-8000-000000000004",
  );
  assert.deepEqual(result, { orderId: "order_existing", replayed: true });
  assert.ok(commerceQueries.some((query) => query.includes("worker_payment_correlation_id")));
  assert.ok(appQueries.some((query) => query.includes("SET medusa_order_id = $2")));
});
