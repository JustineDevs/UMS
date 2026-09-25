import assert from "node:assert/strict";
import test from "node:test";

import { normalizeStorefrontShippingAddress } from "./server-customer-profile";

test("normalizes Worker snake_case delivery addresses for profile gates", () => {
  assert.deepEqual(
    normalizeStorefrontShippingAddress({
      id: "addr_1",
      is_default: true,
      full_name: "Maria Dela Cruz",
      phone: "09171234567",
      address_1: "123 Sampaloc St",
      address_2: "Unit 4",
      barangay: "169",
      city: "Manila",
      province: "Metro Manila",
      postal_code: "1000",
      country_code: "PH",
    }),
    {
      id: "addr_1",
      isDefault: true,
      fullName: "Maria Dela Cruz",
      phone: "09171234567",
      line1: "123 Sampaloc St",
      line2: "Unit 4",
      barangay: "169",
      city: "Manila",
      province: "Metro Manila",
      postalCode: "1000",
      country: "PH",
    },
  );
});

test("rejects an address without required delivery fields", () => {
  assert.equal(
    normalizeStorefrontShippingAddress({
      full_name: "Maria Dela Cruz",
      address_1: "123 Sampaloc St",
      city: "Manila",
    }),
    null,
  );
});
