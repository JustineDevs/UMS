import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizePhilippinePhoneE164,
  storefrontShippingToMedusaAddress,
} from "./medusa-profile-address";

test("normalizePhilippinePhoneE164 normalizes common PH formats", () => {
  assert.equal(normalizePhilippinePhoneE164("09171234567"), "+639171234567");
  assert.equal(normalizePhilippinePhoneE164("639171234567"), "+639171234567");
  assert.equal(normalizePhilippinePhoneE164("+639171234567"), "+639171234567");
  assert.equal(normalizePhilippinePhoneE164("9171234567"), "+639171234567");
});

test("storefrontShippingToMedusaAddress maps fields for Medusa cart", () => {
  const m = storefrontShippingToMedusaAddress({
    fullName: "Juan Dela Cruz",
    phone: "09171234567",
    line1: "123 Rizal St",
    barangay: "Ermita",
    city: "Manila",
    province: "Metro Manila",
    country: "PH",
    postalCode: "1000",
  });
  assert.equal(m.first_name, "Juan");
  assert.equal(m.last_name, "Dela Cruz");
  assert.equal(m.phone, "+639171234567");
  assert.equal(m.address_1, "123 Rizal St");
  assert.equal(m.address_2, "Barangay Ermita");
  assert.equal(m.city, "Manila");
  assert.equal(m.province, "metro manila");
  assert.equal(m.country_code, "ph");
  assert.equal(m.postal_code, "1000");
});
