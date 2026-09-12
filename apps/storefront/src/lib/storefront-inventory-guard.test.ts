import assert from "node:assert/strict";
import test from "node:test";

import { assertStorefrontLinesStock } from "./storefront-inventory-guard";

test("uses the Worker inventory authority when API_URL is configured", async () => {
  const previousUrl = process.env.API_URL;
  const previousFetch = globalThis.fetch;
  process.env.API_URL = "https://api.example.test";
  globalThis.fetch = async () =>
    Response.json({
      availability: {
        manageInventory: true,
        availableQuantity: 3,
      },
    });
  try {
    assert.deepEqual(
      await assertStorefrontLinesStock([{ variantId: "var_1", quantity: 2 }]),
      { ok: true },
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousUrl;
  }
});

test("fails closed when the Worker reports insufficient inventory", async () => {
  const previousUrl = process.env.API_URL;
  const previousFetch = globalThis.fetch;
  process.env.API_URL = "https://api.example.test";
  globalThis.fetch = async () =>
    Response.json({
      availability: {
        manageInventory: true,
        availableQuantity: 1,
      },
    });
  try {
    const result = await assertStorefrontLinesStock([{ variantId: "var_1", quantity: 2 }]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "INSUFFICIENT_STOCK");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousUrl;
  }
});
