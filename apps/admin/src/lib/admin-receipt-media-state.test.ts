import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogMediaEmptyState,
  classifyReceiptLookup,
} from "./admin-receipt-media-state.js";
import {
  normalizeMedusaOrderReference,
  resolveMedusaOrderReference,
} from "./medusa-order-bridge.js";

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

test("receipt references accept display-number formatting", () => {
  assert.equal(normalizeMedusaOrderReference(" #49 "), "49");
  assert.equal(normalizeMedusaOrderReference("order_123"), "order_123");
});

test("receipt display numbers resolve to the matching canonical order", async () => {
  const previousFetch = globalThis.fetch;
  const previousBackendUrl = process.env.MEDUSA_BACKEND_URL;
  const previousSecret = process.env.MEDUSA_SECRET_API_KEY;
  process.env.MEDUSA_BACKEND_URL = "http://localhost:9000";
  process.env.MEDUSA_SECRET_API_KEY = "test-secret";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        count: 2,
        orders: [
          { id: "order_150", display_id: 150 },
          { id: "order_149", display_id: 149 },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  try {
    assert.equal(await resolveMedusaOrderReference("#149"), "order_149");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBackendUrl === undefined) delete process.env.MEDUSA_BACKEND_URL;
    else process.env.MEDUSA_BACKEND_URL = previousBackendUrl;
    if (previousSecret === undefined) delete process.env.MEDUSA_SECRET_API_KEY;
    else process.env.MEDUSA_SECRET_API_KEY = previousSecret;
  }
});
