import test from "node:test";
import assert from "node:assert/strict";
import { MedusaAdminConfigurationError } from "./medusa-admin-configuration-error";
import {
  formatMedusaCheckoutError,
  tryDeleteStoreCart,
} from "./medusa-checkout-errors";

test("formatMedusaCheckoutError maps MedusaAdminConfigurationError to a safe message", () => {
  const msg = formatMedusaCheckoutError(new MedusaAdminConfigurationError());
  assert.match(msg, /temporarily unavailable/i);
  assert.doesNotMatch(msg, /MEDUSA_SECRET/i);
});

test("formatMedusaCheckoutError hides raw env configuration errors", () => {
  const msg = formatMedusaCheckoutError(
    new Error("MEDUSA_SECRET_API_KEY is not set"),
  );
  assert.match(msg, /temporarily unavailable/i);
  assert.doesNotMatch(msg, /MEDUSA_SECRET/i);
});

test("tryDeleteStoreCart removes every partially-created line", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? "GET" });
    if (!init?.method) {
      return Response.json({ cart: { items: [{ id: "line_1" }, { id: "line_2" }] } });
    }
    return new Response(null, { status: 204 });
  };

  try {
    await tryDeleteStoreCart("cart_1", "https://medusa.test/", "pk_test");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    {
      url: "https://medusa.test/store/carts/cart_1?fields=id,*items",
      method: "GET",
    },
    {
      url: "https://medusa.test/store/carts/cart_1/line-items/line_1",
      method: "DELETE",
    },
    {
      url: "https://medusa.test/store/carts/cart_1/line-items/line_2",
      method: "DELETE",
    },
  ]);
});
