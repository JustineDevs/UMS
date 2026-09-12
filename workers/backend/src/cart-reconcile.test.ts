import assert from "node:assert/strict";
import test from "node:test";
import { handleCartReconcileRequest } from "./cart-reconcile.ts";

test("reconciles cart lines from published catalog price and inventory", async () => {
  const response = await handleCartReconcileRequest(
    new Request("https://api.test/store/cart/reconcile", {
      method: "POST",
      body: JSON.stringify({ lines: [{ variantId: "var-1", quantity: 2 }] }),
      headers: { "Content-Type": "application/json" },
    }),
    {
      async query<Row>(_sql: string, values: readonly unknown[] = []) {
        assert.deepEqual(values, [["var-1"]]);
        return {
          rowCount: 1,
          rows: [{
            variant_id: "var-1", product_handle: "canary", product_title: "Canary",
            product_thumbnail: "/canary.jpg", variant_sku: "GTR-1",
            product_metadata: { type: "guitar", finish: "white" }, currency_code: "php",
            unit_price: 599700, available_quantity: 3, allow_backorder: false,
          }] as Row[],
        };
      },
      async end() {},
    },
  );
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { cartTotal: number; lines: Array<Record<string, unknown>> };
  assert.equal(payload.cartTotal, 11994);
  assert.equal(payload.lines[0]?.price, 5997);
  assert.equal(payload.lines[0]?.availableQuantity, 3);
  assert.equal(payload.lines[0]?.status, "current");
});

test("fails closed when a requested variant is not published", async () => {
  const response = await handleCartReconcileRequest(
    new Request("https://api.test/store/cart/reconcile", {
      method: "POST", body: JSON.stringify({ lines: [{ variantId: "missing", quantity: 1 }] }),
      headers: { "Content-Type": "application/json" },
    }),
    { async query<Row>() { return { rowCount: 0, rows: [] as Row[] }; }, async end() {} },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Catalog reconciliation is temporarily unavailable",
    lines: [{ variantId: "missing", status: "error" }],
  });
});
