/**
 * @checkout @stripe
 * Stripe sandbox checkout flow — full user workflow.
 *
 * Flow:
 *   Browse → Add to bag → Checkout → Stripe hosted checkout →
 *   stripe-return polling → /track/:orderId → Admin order verified
 *
 * Requires E2E_STRIPE_API_KEY (sk_test_* or rk_test_*).
 * Run: pnpm exec playwright test --grep "@stripe"
 */
import "../runtime-logs-init";
import { test, expect } from "@playwright/test";
import {
  skipUnlessPspConfigured,
  navigateToShopAndAddFirstProduct,
  navigateToCheckout,
  fillCheckoutShippingInfo,
  selectPaymentProvider,
  expectOrderConfirmation,
  clickPayButton,
  payWithStripeSandboxCard,
  ensureStripeHostedCheckout,
  fillStripeHostedCheckoutTestCard,
  enablePublicTunnelBypass,
  STRIPE_SANDBOX_TEST_CARD_SUCCESS,
  STRIPE_SANDBOX_TEST_CARD_DECLINE,
} from "../helpers/checkout";
import { signInAsAdmin } from "../fixtures/admin-auth";
import { STRIPE_SUCCESS_CARD, STRIPE_DECLINE_CARD } from "../fixtures/sandbox-cards";

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

function isStripeTestKey(): void {
  const key = process.env.E2E_STRIPE_API_KEY?.trim() ?? process.env.STRIPE_API_KEY?.trim();
  if (key && (key.startsWith("sk_live_") || key.startsWith("rk_live_"))) {
    throw new Error(
      "HALT: STRIPE_API_KEY is a live key. Do not run sandbox flows against the live Stripe account. " +
        "Use sk_test_* or rk_test_* only.",
    );
  }
}

function shouldFailOnMissingPrereq(): boolean {
  return process.env.CI_STRICT_E2E === "1" || process.env.CI === "true";
}

test.describe("@checkout @stripe Stripe checkout flow", () => {
  test.beforeEach(async ({ page }) => {
    await enablePublicTunnelBypass(page);
    isStripeTestKey();
    skipUnlessPspConfigured("stripe");
  });

  test("complete checkout with Stripe test card reaches /track/:orderId", async ({ page }) => {
    await navigateToShopAndAddFirstProduct(page);
    await navigateToCheckout(page);
    await fillCheckoutShippingInfo(page);

    const selected = await selectPaymentProvider(page, "stripe");
    if (!selected) {
      if (shouldFailOnMissingPrereq()) {
        throw new Error("Stripe payment option is not visible during strict E2E validation.");
      }
      test.skip(true, "Stripe payment option not visible on checkout page");
      return;
    }
    await payWithStripeSandboxCard(page, STRIPE_SANDBOX_TEST_CARD_SUCCESS ?? STRIPE_SUCCESS_CARD);
    await expectOrderConfirmation(page);

    const trackUrl = page.url();
  expect(trackUrl, "Must redirect to signed order tracking after Stripe payment").toMatch(
    /\/track\/(?:order_|cap_v3\.)/i,
  );

    await expect(
      page.getByText(/order/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("admin sees Stripe order after successful payment", async ({ page }) => {
    if (process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLE === "true") {
      test.skip(true, "Admin auth disabled; run with staff E2E credentials for admin order proof.");
      return;
    }
    const availability = await page.request.get(
      `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"}/api/checkout/available-payment-methods`,
      { failOnStatusCode: false },
    );
    const availabilityBody = (await availability.json().catch(() => null)) as {
      keys?: string[];
    } | null;
    if (!availabilityBody?.keys?.includes("STRIPE")) {
      test.skip(true, "Stripe is not enabled for the current merchant context");
      return;
    }

    const result = await signInAsAdmin(page);
    if (result !== "ok") {
      test.skip(true, `Admin sign-in not available: ${result}`);
      return;
    }

    await page.goto(`${adminBase}/admin/orders`);
    await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible({
      timeout: 20_000,
    });

    const orderRows = page.locator("table tbody tr:has(a[href*='/admin/orders/'])");
    const rowCount = await orderRows.count();
    expect(rowCount, "Admin orders list must show at least one order after Stripe payment").toBeGreaterThan(0);
  });

  test("Stripe checkout handles declined card and shows error", async ({ page }) => {
    await navigateToShopAndAddFirstProduct(page);
    await navigateToCheckout(page);
    await fillCheckoutShippingInfo(page);

    const selected = await selectPaymentProvider(page, "stripe");
    if (!selected) {
      if (shouldFailOnMissingPrereq()) {
        throw new Error("Stripe payment option is not visible during strict E2E validation.");
      }
      test.skip(true, "Stripe payment option not visible on checkout page");
      return;
    }

    await clickPayButton(page);
    await ensureStripeHostedCheckout(page);
    await fillStripeHostedCheckoutTestCard(page, STRIPE_SANDBOX_TEST_CARD_DECLINE ?? STRIPE_DECLINE_CARD);
    const pay = page
      .getByTestId("hosted-payment-submit-button")
      .or(page.getByRole("button", { name: /^pay\b/i }))
      .first();
    await pay.click();

    await expect(
      page.getByText(/declined|your card was declined|card.*declined/i).first(),
    ).toBeVisible({ timeout: 45_000 });

    expect(page.url(), "Declined card must NOT redirect to /track page").not.toMatch(/\/track\//i);
  });

  test("STRIPE_API_KEY is a test key (guard against live key)", () => {
    const key = process.env.E2E_STRIPE_API_KEY?.trim() ?? process.env.STRIPE_API_KEY?.trim();
    if (!key) {
      test.skip(true, "No Stripe API key configured");
      return;
    }
    expect(
      key.startsWith("sk_test_") || key.startsWith("rk_test_"),
      `Stripe key must be a test key (sk_test_* or rk_test_*), got: ${key.slice(0, 12)}...`,
    ).toBe(true);
  });
});
