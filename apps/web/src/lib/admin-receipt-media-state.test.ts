import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogMediaEmptyState,
  classifyReceiptLookup,
} from "./admin-receipt-media-state.js";

test("receipt lookup distinguishes found, not-found, and unavailable", () => {
  assert.equal(classifyReceiptLookup(0, false, false), "empty");
  assert.equal(classifyReceiptLookup(200, true), "found");
  assert.equal(classifyReceiptLookup(404, false), "not_found");
  assert.equal(classifyReceiptLookup(503, false), "unavailable");
  assert.equal(classifyReceiptLookup(200, false), "unavailable");
});

test("catalog media distinguishes an empty library from filtered results", () => {
  assert.equal(catalogMediaEmptyState(0, false), "none");
  assert.equal(catalogMediaEmptyState(0, true), "filtered");
  assert.equal(catalogMediaEmptyState(1, true), "none");
  assert.equal(catalogMediaEmptyState(0, false, true), "unavailable");
  assert.equal(catalogMediaEmptyState(1, false, true), "none");
});
