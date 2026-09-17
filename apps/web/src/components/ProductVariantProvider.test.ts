import { strict as assert } from "node:assert";
import test from "node:test";
import type { ProductVariant } from "@universal-music-store/types";
import { findSellableVariantForOptions, isVariantSellable } from "./ProductVariantProvider";

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "variant_1",
    productId: "product_1",
    sku: "SKU-1",
    barcode: null,
    type: "Acoustic",
    finish: "Natural",
    pickupConfig: "",
    bodyWood: "",
    condition: "New",
    skillLevel: "",
    shippingSpeed: "",
    price: 100,
    compareAtPrice: null,
    cost: null,
    manageInventory: true,
    inventoryQuantity: 1,
    isActive: true,
    ...overrides,
  };
}

test("variant sellability uses active state and current inventory", () => {
  assert.equal(isVariantSellable(variant()), true);
  assert.equal(isVariantSellable(variant({ inventoryQuantity: 0 })), false);
  assert.equal(isVariantSellable(variant({ manageInventory: false, inventoryQuantity: 0 })), true);
  assert.equal(isVariantSellable(variant({ isActive: false })), false);
});

test("option combinations resolve only to an existing sellable variant", () => {
  const product = {
    variants: [
      { id: "acoustic-natural", type: "Acoustic", finish: "Natural", isActive: true, manageInventory: true, inventoryQuantity: 2 },
      { id: "electric-black", type: "Electric", finish: "Black", isActive: true, manageInventory: true, inventoryQuantity: 1 },
    ],
  } as never;
  assert.equal(findSellableVariantForOptions(product, { type: "Acoustic", finish: "Black" }), undefined);
  assert.equal(findSellableVariantForOptions(product, { type: "Electric", finish: "Black" })?.id, "electric-black");
});
