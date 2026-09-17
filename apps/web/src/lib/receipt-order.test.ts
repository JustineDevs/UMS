import assert from "node:assert/strict";
import test from "node:test";
import { canonicalReceiptOrderFromMedusa } from "./receipt-order";

test("canonicalReceiptOrderFromMedusa derives receipt fields from the canonical order payload", () => {
  const result = canonicalReceiptOrderFromMedusa({
    id: "ord_1",
    display_id: 42,
    email: "buyer@example.com",
    currency_code: "php",
    total: 1299,
    items: [{ title: "Vinyl", quantity: 2, unit_price: 649.5 }],
  });
  assert.deepEqual(
    {
      id: result.id,
      display_id: result.display_id,
      total: result.total,
      currency_code: result.currency_code,
    },
    { id: "ord_1", display_id: "42", total: 1299, currency_code: "PHP" },
  );
  assert.deepEqual(result.items[0], {
    title: "Vinyl",
    quantity: 2,
    unit_price: 650,
  });
});

test("canonicalReceiptOrderFromMedusa does not accept client-shaped receipt totals or recipient fields", () => {
  const result = canonicalReceiptOrderFromMedusa({
    id: "ord_2",
    total: "not-a-number",
    customer_email: "spoof@example.com",
  });
  assert.equal(result.total, 0);
  assert.equal(result.customer_email, null);
});
