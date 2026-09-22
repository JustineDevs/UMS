import assert from "node:assert/strict";
import test from "node:test";

import { paymentCheckoutIntentSchema } from "./admin-api-contracts";

test("checkout intent accepts storefront cart display fields while retaining checkout fields", () => {
  const parsed = paymentCheckoutIntentSchema.parse({
    provider: "cod",
    lines: [
      {
        variantId: "variant_1",
        quantity: 2,
        slug: "native-guitar",
        name: "E2E Native Guitar",
        sku: "E2E-NATIVE-GUITAR",
        price: 12999,
        currencyCode: "PHP",
        availableQuantity: 4,
      },
    ],
  });

  assert.deepEqual(parsed.lines, [{ variantId: "variant_1", quantity: 2 }]);
});
