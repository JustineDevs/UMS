import assert from "node:assert/strict";
import test from "node:test";
import { buildFreshnessSignature } from "./BrowsePriceFreshnessCue";

test("freshness signature changes when tracked inventory or sellability changes", () => {
  const before = buildFreshnessSignature([
    { id: "v1", inventoryQuantity: 2, manageInventory: true, isActive: true },
  ]);
  const after = buildFreshnessSignature([
    { id: "v1", inventoryQuantity: 1, manageInventory: true, isActive: true },
  ]);
  assert.notEqual(before, after);
});

test("freshness signature is order independent", () => {
  const first = buildFreshnessSignature([
    { id: "v2", inventoryQuantity: 1 },
    { id: "v1", inventoryQuantity: 3 },
  ]);
  const second = buildFreshnessSignature([
    { id: "v1", inventoryQuantity: 3 },
    { id: "v2", inventoryQuantity: 1 },
  ]);
  assert.equal(first, second);
});
