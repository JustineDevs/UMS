import assert from "node:assert/strict";
import test from "node:test";

import { accountMutationFailure } from "./account-mutation-error";

test("account mutation failures expose only safe copy and correlation ID", () => {
  const upstreamDetail = "Medusa token=secret provider stack trace";
  const result = accountMutationFailure(
    "Could not cancel the order right now.",
    "corr_test",
  );

  assert.deepEqual(result, {
    error: "Could not cancel the order right now.",
    correlationId: "corr_test",
  });
  assert.equal(JSON.stringify(result).includes(upstreamDetail), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});
