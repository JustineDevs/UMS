import assert from "node:assert/strict";
import test from "node:test";

import { canonicalProductIdFromAdminVariant } from "./cart-reconcile-identity";

test("cart reconciliation accepts only the canonical Admin variant product id", () => {
  assert.equal(
    canonicalProductIdFromAdminVariant({ product_id: "prod_canonical" }),
    "prod_canonical",
  );
  assert.equal(canonicalProductIdFromAdminVariant({ product_id: "   " }), null);
  assert.equal(canonicalProductIdFromAdminVariant({ product_id: "prod_client_slug" }), "prod_client_slug");
  assert.equal(canonicalProductIdFromAdminVariant(null), null);
});
