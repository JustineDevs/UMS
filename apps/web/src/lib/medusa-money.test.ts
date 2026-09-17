import assert from "node:assert/strict";
import { test } from "node:test";

import { medusaMinorToMajor, minorUnitDivisor } from "./medusa-money";

test("PHP uses 100 minor units", () => {
  assert.equal(minorUnitDivisor("PHP"), 100);
  assert.equal(medusaMinorToMajor(12_345, "PHP"), 123.45);
});

test("JPY uses whole yen", () => {
  assert.equal(minorUnitDivisor("JPY"), 1);
  assert.equal(medusaMinorToMajor(1500, "JPY"), 1500);
});

test("three-decimal currencies preserve minor-unit precision", () => {
  assert.equal(minorUnitDivisor("BHD"), 1000);
  assert.equal(medusaMinorToMajor(1234, "BHD"), 1.234);
});

test("conversion rounds floating-point noise without changing the authoritative minor amount", () => {
  assert.equal(medusaMinorToMajor(1, "PHP"), 0.01);
  assert.equal(medusaMinorToMajor(999999999, "JPY"), 999999999);
});
