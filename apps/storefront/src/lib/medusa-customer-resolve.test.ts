import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMedusaCustomerProfilePatch,
  pickExactMedusaCustomerId,
} from "./medusa-customer-resolve";

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

test("customer resolution rejects fuzzy matches and accepts only exact email", () => {
  assert.equal(
    pickExactMedusaCustomerId(
      [
        { id: "cus_other", email: "buyer+old@example.com" },
        { id: "cus_exact", email: "Buyer@Example.com" },
      ],
      " buyer@example.com ",
    ),
    "cus_exact",
  );
  assert.equal(
    pickExactMedusaCustomerId([{ id: "cus_other", email: "other@example.com" }], "buyer@example.com"),
    null,
  );
  assert.equal(pickExactMedusaCustomerId([{ id: "cus_missing" }], "buyer@example.com"), null);
});
