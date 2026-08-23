import assert from "node:assert/strict";
import test from "node:test";
import { resolvePaymentReceiptOrganizationId } from "./payment-receipt-organization";

test("payment receipt organization resolution never invents a default tenant", () => {
  assert.equal(resolvePaymentReceiptOrganizationId({}), null);
  assert.equal(
    resolvePaymentReceiptOrganizationId({
      paymentAttemptOrganizationId: " org_from_attempt ",
      configuredOrganizationId: "org_from_config",
    }),
    "org_from_attempt",
  );
  assert.equal(
    resolvePaymentReceiptOrganizationId({ configuredOrganizationId: " org_from_config " }),
    "org_from_config",
  );
});
