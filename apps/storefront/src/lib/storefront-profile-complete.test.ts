import assert from "node:assert/strict";
import test from "node:test";

import {
  isStorefrontProfileComplete,
  listMissingProfileParts,
} from "./storefront-profile-complete";

test("isStorefrontProfileComplete requires barangay for Philippine addresses", () => {
  const missingBarangay = isStorefrontProfileComplete({
    displayName: "Maria Dela Cruz",
    phone: "09171234567",
    avatarUrl: null,
    shippingAddresses: [
      {
        fullName: "Maria Dela Cruz",
        phone: "09171234567",
        line1: "123 Sampaloc St",
        city: "Manila",
        province: "Metro Manila",
        country: "PH",
      },
    ],
  });

  assert.equal(missingBarangay, false);
});

test("listMissingProfileParts flags incomplete Philippine delivery addresses without barangay", () => {
  const missing = listMissingProfileParts({
    displayName: "Maria Dela Cruz",
    phone: "09171234567",
    avatarUrl: null,
    shippingAddresses: [
      {
        fullName: "Maria Dela Cruz",
        phone: "09171234567",
        line1: "123 Sampaloc St",
        city: "Manila",
        province: "Metro Manila",
        country: "PH",
      },
    ],
  });

  assert.deepEqual(missing, ["Complete delivery address"]);
});
