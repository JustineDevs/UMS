import assert from "node:assert/strict";
import test from "node:test";
import {
  publicDeliveryIdempotencyKey,
  recordPublicDeliveryAttempt,
} from "./public-delivery.js";

test("public delivery keys are stable and namespace lifecycle aggregates", () => {
  assert.equal(
    publicDeliveryIdempotencyKey("newsletter_confirmation", "abc"),
    "newsletter_confirmation:abc",
  );
  assert.notEqual(
    publicDeliveryIdempotencyKey("back_in_stock", "abc"),
    publicDeliveryIdempotencyKey("newsletter_confirmation", "abc"),
  );
});

test("delivery attempt persistence is idempotent", async () => {
  const calls: unknown[] = [];
  const supabase = {
    from: (table: string) => ({
      upsert: async (row: unknown, options: unknown) => {
        calls.push({ table, row, options });
        return { error: null };
      },
    }),
  } as never;

  assert.equal(
    await recordPublicDeliveryAttempt(supabase, {
      kind: "public_form_webhook",
      aggregateId: "submission_1",
      recipient: "https://example.test/hook",
      provider: "webhook",
    }),
    true,
  );
  assert.deepEqual(calls, [{
    table: "public_delivery_attempts",
    row: {
      delivery_kind: "public_form_webhook",
      aggregate_id: "submission_1",
      recipient: "https://example.test/hook",
      provider: "webhook",
      idempotency_key: "public_form_webhook:submission_1",
    },
    options: { onConflict: "idempotency_key", ignoreDuplicates: true },
  }]);
});
