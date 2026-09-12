import assert from "node:assert/strict";
import test from "node:test";
import { defaultPlatformRuntimeSettings, mergePlatformRuntimeSettings } from "./runtime-settings.ts";

test("runtime settings use safe environment defaults", () => {
  const settings = defaultPlatformRuntimeSettings({
    STORE_NAME: "  Demo Store ",
    NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS: "STRIPE, COD, unknown, STRIPE",
    DATA_RETENTION_DAYS: "365",
    ADMIN_LOW_STOCK_THRESHOLD: "12",
  });
  assert.equal(settings.storeName, "Demo Store");
  assert.deepEqual(settings.enabledPaymentProviders, ["STRIPE", "COD"]);
  assert.equal(settings.retentionDays, 365);
  assert.equal(settings.lowStockThreshold, 12);
});

test("runtime settings reject unsafe URLs and out-of-range values", () => {
  const settings = mergePlatformRuntimeSettings({
    retentionDays: 0,
    lowStockThreshold: -1,
    policyLinks: { returns: "javascript:alert(1)", warrantyPdf: "http://unsafe.example" },
    enabledPaymentProviders: ["STRIPE", "STRIPE", "NOT_A_PROVIDER"],
  });
  assert.equal(settings.retentionDays, 730);
  assert.equal(settings.lowStockThreshold, 1000);
  assert.equal(settings.policyLinks.returns, "/returns");
  assert.equal(settings.policyLinks.warrantyPdf, "");
  assert.deepEqual(settings.enabledPaymentProviders, ["STRIPE"]);
});
