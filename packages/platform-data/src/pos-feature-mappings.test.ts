import assert from "node:assert/strict";
import test from "node:test";
import { buildPosSaleFeatureMetadata, POS_FEATURE_MAPPINGS } from "./pos-feature-mappings.js";

test("POS feature mappings cover the staff-facing sale destinations", () => {
  assert.deepEqual(
    POS_FEATURE_MAPPINGS.map((mapping) => mapping.key),
    ["order_tag", "e_invoice", "receipt", "customer_attribution"],
  );
});

test("POS sale metadata is normalized and does not include invoice fields when unused", () => {
  assert.deepEqual(buildPosSaleFeatureMetadata({ orderTag: "  showroom  " }), {
    pos_channel: "in_store",
    pos_order_tag: "showroom",
  });
  assert.deepEqual(
    buildPosSaleFeatureMetadata({
      eInvoiceRequested: true,
      eInvoiceCustomerEmail: " buyer@example.com ",
      eInvoiceCustomerTin: " 123-456 ",
    }),
    {
      pos_channel: "in_store",
      e_invoice_requested: true,
      e_invoice_customer_email: "buyer@example.com",
      e_invoice_customer_tin: "123-456",
    },
  );
});
