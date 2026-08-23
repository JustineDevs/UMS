import assert from "node:assert/strict";
import test from "node:test";
import { buildMedusaCustomerProfilePatch } from "./medusa-customer-resolve";

test("profile sync maps supported fields without inventing customer data", () => {
  assert.deepEqual(buildMedusaCustomerProfilePatch({ displayName: "Ada Lovelace", phone: "+639171234567" }), {
    first_name: "Ada",
    last_name: "Lovelace",
    phone: "+639171234567",
  });
  assert.deepEqual(buildMedusaCustomerProfilePatch({ displayName: "Ada" }), {
    first_name: "Ada",
    last_name: "",
  });
  assert.deepEqual(buildMedusaCustomerProfilePatch({}), {});
});
