import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultCatalogProviderDrafts,
  expandProviderDraftToArtifactRows,
} from "./catalog-provider-projections.js";

test("defaultCatalogProviderDrafts marks Stripe as automatic catalog publishing", () => {
  const drafts = defaultCatalogProviderDrafts("prod_123");
  const stripe = drafts.find((draft) => draft.provider === "stripe");
  assert.ok(stripe);
  assert.equal(stripe?.enabled, true);
  assert.equal(stripe?.includePaymentLink, true);
  assert.equal(stripe?.syncMode, "automatic");
  assert.equal(stripe?.metadata?.productId, "prod_123");
});

test("expandProviderDraftToArtifactRows keeps checkout-only providers truthful", () => {
  const rows = expandProviderDraftToArtifactRows({
    medusaProductId: "prod_123",
    draft: {
      provider: "paypal",
      enabled: true,
      syncMode: "manual",
      includePaymentLink: false,
    },
    pricePhp: 4500,
    productTitle: "Test Guitar",
    productHandle: "test-guitar",
    actorEmail: "ops@example.com",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.provider, "paypal");
  assert.equal(rows[0]?.artifact_type, "checkout_order");
  assert.equal(rows[0]?.sync_state, "manual_only");
  assert.equal(rows[0]?.sync_mode, "manual");
});

test("expandProviderDraftToArtifactRows disables projections when provider is off", () => {
  const rows = expandProviderDraftToArtifactRows({
    medusaProductId: "prod_123",
    draft: {
      provider: "stripe",
      enabled: false,
      includePaymentLink: true,
    },
  });

  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.sync_state === "disabled"));
});
