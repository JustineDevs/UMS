import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { describe, it } from "node:test";

import {
  getPaymentAttemptByCorrelationId,
  registerPaymentAttempt,
  updatePaymentAttemptByCorrelationId,
} from "./payment-ledger.js";

describe("payment_ledger Supabase integration (service role)", () => {
  it("bumps quote_version when quote_fingerprint changes via updatePaymentAttemptByCorrelationId", async (t) => {
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      t.skip("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
      return;
    }

    const sb = createClient(url, key);
    const cartId = `e2e_ledger_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const { correlationId } = await registerPaymentAttempt(sb, {
      cartId,
      provider: "stripe",
      amountMinor: 100,
      currencyCode: "php",
      quoteFingerprint: "qf_integration_a",
    });

    try {
      const inserted = await getPaymentAttemptByCorrelationId(sb, correlationId);
      assert.equal(inserted?.quote_version ?? null, 1);

      await updatePaymentAttemptByCorrelationId(sb, correlationId, {
        quote_fingerprint: "qf_integration_b",
      });

      const updated = await getPaymentAttemptByCorrelationId(sb, correlationId);
      assert.equal(updated?.quote_fingerprint, "qf_integration_b");
      assert.equal(updated?.quote_version, 2);
    } finally {
      await sb.from("payment_attempts").delete().eq("correlation_id", correlationId);
    }
  });
});
