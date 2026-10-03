import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultInvoiceValues,
  getInvoiceSubmissionErrors,
  toInvoiceCreatePayload,
} from "./data";

test("invoice defaults are blank, usable creation state rather than demo data", () => {
  const invoice = getDefaultInvoiceValues();
  assert.equal(invoice.from.name, "Universal Music Store");
  assert.equal(invoice.items.length, 1);
  assert.equal(invoice.items[0]?.description, "");
  assert.equal(invoice.discountValue, 0);
});

test("invoice validation rejects incomplete and invalid dates", () => {
  const invoice = getDefaultInvoiceValues();
  invoice.to = { id: "", name: "", email: "", addressLines: [], taxId: "" };
  invoice.paymentDueDate = "2026-01-01";
  const errors = getInvoiceSubmissionErrors(invoice);
  assert.equal(errors.some((error) => error.field === "to"), true);
  assert.equal(errors.some((error) => error.field === "items.0.description"), true);
  assert.equal(errors.some((error) => error.field === "paymentDueDate"), true);
});

test("submission payload maps the UI tax selection to the strict API taxRate", () => {
  const invoice = getDefaultInvoiceValues();
  invoice.to = { id: "customer-1", name: "Customer", email: "customer@example.com", addressLines: [], taxId: "" };
  invoice.items[0] = { id: "item-1", description: "Guitar strings", quantity: 2, unitPrice: 500 };
  const payload = toInvoiceCreatePayload(invoice);
  assert.equal(payload.taxRate, 12);
  assert.equal("taxId" in payload, false);
  assert.equal("from" in payload, false);
});
