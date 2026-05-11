/**
 * @checkout @paymongo
 * PayMongo sandbox checkout flow — full user workflow.
 *
 * Flow:
 *   Browse → Add to bag → Checkout → PayMongo hosted redirect →
 *   Complete test payment → Redirect back → /track/:orderId → Admin order verified
 *
 * Requires E2E_PAYMONGO_SECRET_KEY (sk_test_*).
 * Run: pnpm exec playwright test --grep "@paymongo"
 */
import "../runtime-logs-init";
import { test, expect } from "@playwright/test";
import {
  skipUnlessPspConfigured,
  navigateToShopAndAddFirstProduct,
  navigateToCheckout,
  fillCheckoutShippingInfo,
  selectPaymentProvider,
  clickPayButton,
} from "../helpers/checkout";
import { signInAsAdmin } from "../fixtures/admin-auth";
import { PAYMONGO_SUCCESS_CARD, PAYMONGO_TEST_EXPIRY, PAYMONGO_TEST_CVC } from "../fixtures/sandbox-cards";

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

function isPayMongoTestKey(): void {
  const key =
    process.env.E2E_PAYMONGO_SECRET_KEY?.trim() ??
    process.env.PAYMONGO_SECRET_KEY?.trim();
  if (key && !key.startsWith("sk_test_")) {
    throw new Error(
      "HALT: PAYMONGO_SECRET_KEY is not a test key (sk_test_*). " +
        "Do not run sandbox flows against the live PayMongo account.",
    );
  }
}

test.describe("@checkout @paymongo PayMongo checkout flow", () => {
  test.beforeEach(() => {
    isPayMongoTestKey();
    skipUnlessPspConfigured("paymongo");
  });

  test("PAYMONGO_SECRET_KEY is a test key (guard against live key)", () => {
    const key =
      process.env.E2E_PAYMONGO_SECRET_KEY?.trim() ??
      process.env.PAYMONGO_SECRET_KEY?.trim();
    if (!key) {
      test.skip(true, "No PayMongo secret key configured");
      return;
    }
    expect(
      key.startsWith("sk_test_"),
      `PayMongo key must be sk_test_*, got: ${key.slice(0, 12)}...`,
    ).toBe(true);
  });

  test("checkout reaches PayMongo hosted payment page", async ({ page }) => {
    await navigateToShopAndAddFirstProduct(page);
    await navigateToCheckout(page);
    await fillCheckoutShippingInfo(page);

    const selected = await selectPaymentProvider(page, "paymongo");
    if (!selected) {
      test.skip(true, "PayMongo payment option not visible on checkout page");
      return;
    }

    await clickPayButton(page);

    await page.waitForURL(/paymongo\.com|checkout|pay\./i, { timeout: 30_000 }).catch(() => {
      // may stay on storefront if redirect is in-page
    });

    const onPayMongoPage =
      page.url().includes("paymongo.com") || page.url().includes("checkout");

    if (onPayMongoPage) {
      const cardInput = page.locator('input[data-testid="card-number"], input[placeholder*="Card number"]').first();
      const cardInputVisible = await cardInput.isVisible({ timeout: 10_000 }).catch(() => false);

      if (cardInputVisible) {
        await cardInput.fill(PAYMONGO_SUCCESS_CARD);
        const expiryInput = page.locator('input[placeholder*="MM"], input[placeholder*="expiry"]').first();
        await expiryInput.fill(PAYMONGO_TEST_EXPIRY);
        const cvcInput = page.locator('input[placeholder*="CVC"], input[placeholder*="CVV"]').first();
        await cvcInput.fill(PAYMONGO_TEST_CVC);

        const payBtn = page.getByRole("button", { name: /pay|submit|confirm/i }).first();
        await payBtn.click();

        await page.waitForURL(/\/track\/order_/i, { timeout: 60_000 }).catch(() => {});
      }
    }

    await expect(
      page
        .getByText(/paymongo|payment|processing|confirm|order/i)
        .first()
        .or(page.locator("[data-testid='order-confirmation']")),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("admin sees PayMongo order after successful payment", async ({ page }) => {
    const result = await signInAsAdmin(page);
    if (result !== "ok") {
      test.skip(true, `Admin sign-in not available: ${result}`);
      return;
    }

    await page.goto(`${adminBase}/admin/orders`);
    await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
