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
