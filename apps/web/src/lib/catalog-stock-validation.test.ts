import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeStockQuantity,
  validateVariantStocksInput,
} from "./catalog-stock-validation";

describe("catalog-stock-validation", () => {
  it("normalizes stock quantities", () => {
    assert.equal(normalizeStockQuantity(3.7), 3);
    assert.equal(normalizeStockQuantity(0), 0);
    assert.equal(normalizeStockQuantity(undefined), undefined);
    assert.equal(normalizeStockQuantity(null), undefined);
    assert.equal(normalizeStockQuantity(-1), undefined);
    assert.equal(normalizeStockQuantity("2" as never), 2);
    assert.equal(normalizeStockQuantity("x" as never), undefined);
  });

  it("rejects duplicate variant ids", () => {
    const allowed = new Set(["variant_a", "variant_b"]);
    const err = validateVariantStocksInput(
      [
        { variantId: "variant_a", quantity: 1 },
        { variantId: "variant_a", quantity: 2 },
      ],
      allowed,
    );
    assert.ok(err?.includes("Duplicate"));
  });

  it("rejects unknown variant ids", () => {
    const allowed = new Set(["variant_a"]);
    const err = validateVariantStocksInput(
      [{ variantId: "variant_x", quantity: 1 }],
      allowed,
    );
    assert.ok(err?.includes("do not belong"));
  });

  it("accepts valid rows", () => {
    const allowed = new Set(["variant_a"]);
    assert.equal(
      validateVariantStocksInput(
        [{ variantId: "variant_a", quantity: 10 }],
        allowed,
      ),
      null,
    );
  });
});
