import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listStalePaymentAttempts,
  listStuckPaymentAttempts,
  paymentAttemptMatchesCatalogMutation,
  shouldReusePaymentAttempt,
} from "./payment-ledger.js";

describe("payment-ledger list aliases", () => {
  it("listStalePaymentAttempts delegates to listStuckPaymentAttempts", async () => {
    const supabase = {
      from() {
        return {
          select() {
            return {
              in() {
                return {
                  is() {
                    return {
                      order() {
                        return {
                          limit() {
                            return Promise.resolve({ data: [], error: null });
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    } as never;

    await assert.doesNotReject(() => listStalePaymentAttempts(supabase, 10));
    await assert.doesNotReject(() => listStuckPaymentAttempts(supabase, 10));
  });

  it("shouldReusePaymentAttempt only reuses identical quote fingerprints", () => {
    assert.equal(
      shouldReusePaymentAttempt({ quote_fingerprint: "qf_same" }, { quoteFingerprint: "qf_same" }),
      true,
    );
    assert.equal(
      shouldReusePaymentAttempt({ quote_fingerprint: "qf_old" }, { quoteFingerprint: "qf_new" }),
      false,
    );
  });

  it("paymentAttemptMatchesCatalogMutation checks variant and product overlap from provider payload", () => {
    assert.equal(
      paymentAttemptMatchesCatalogMutation(
        {
          provider_payload: {
            quote: {
              variant_ids: ["variant_1"],
              product_ids: ["prod_1"],
            },
          },
        },
        { variantIds: ["variant_1"] },
      ),
      true,
    );
    assert.equal(
      paymentAttemptMatchesCatalogMutation(
        {
          provider_payload: {
            quote: {
              variant_ids: ["variant_1"],
              product_ids: ["prod_1"],
            },
          },
        },
        { productIds: ["prod_other"] },
      ),
      false,
    );
  });
});
