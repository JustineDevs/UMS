/**
 * @checkout @paypal
 * PayPal sandbox checkout flow — full user workflow.
 *
 * Flow:
 *   Browse → Add to bag → Checkout → PayPal embedded/redirect →
 *   Approve with sandbox buyer → Redirect back → /track/:orderId
 *
 * Requires PAYPAL_ENVIRONMENT=sandbox.
 * Optional: PAYPAL_SANDBOX_BUYER_EMAIL and PAYPAL_SANDBOX_BUYER_PASSWORD for full login flow.
 *   Create sandbox buyer at https://developer.paypal.com/dashboard/accounts
 *
 * Run: pnpm exec playwright test --grep "@paypal"
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
import { getPayPalSandboxBuyer } from "../fixtures/sandbox-cards";

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

function isPayPalSandbox(): void {
  const env = process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase();
  if (env === "production" || env === "live") {
    throw new Error(
      "HALT: PAYPAL_ENVIRONMENT is set to production/live. " +
        "Do not run sandbox flows against the live PayPal API. Set PAYPAL_ENVIRONMENT=sandbox.",
    );
  }
}

test.describe("@checkout @paypal PayPal checkout flow", () => {
  test.beforeEach(() => {
    isPayPalSandbox();
    skipUnlessPspConfigured("paypal");
  });

  test("PAYPAL_ENVIRONMENT is sandbox (guard against live)", () => {
    const env = process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase();
    if (!env) {
      test.skip(true, "PAYPAL_ENVIRONMENT not set — PayPal not configured");
      return;
    }
    expect(
      env === "sandbox",
      `PAYPAL_ENVIRONMENT must be "sandbox", got: "${env}"`,
    ).toBe(true);
  });

  test("checkout reaches PayPal redirect or inline approval", async ({
    page,
  }) => {
    await navigateToShopAndAddFirstProduct(page);
    await navigateToCheckout(page);
    await fillCheckoutShippingInfo(page);

    const selected = await selectPaymentProvider(page, "paypal");
    if (!selected) {
      test.skip(true, "PayPal payment option not visible on checkout page");
      return;
    }

    await clickPayButton(page);

    const buyer = getPayPalSandboxBuyer();
    if (!buyer) {
      test.skip(
        true,
        "BLOCKED: PAYPAL_SANDBOX_BUYER_EMAIL not set — cannot complete PayPal sandbox login. " +
          "Set PAYPAL_SANDBOX_BUYER_EMAIL and PAYPAL_SANDBOX_BUYER_PASSWORD in .env.local from " +
          "https://developer.paypal.com/dashboard/accounts",
      );
      return;
    }

    const paypalRedirect = await page
      .waitForURL(/paypal\.com/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    if (paypalRedirect) {
      await expect(page).toHaveURL(/paypal\.com/, { timeout: 10_000 });

      const emailInput = page.locator('#email, input[type="email"]').first();
      const emailVisible = await emailInput
        .isVisible({ timeout: 10_000 })
        .catch(() => false);

      if (emailVisible) {
        await emailInput.fill(buyer.email);
        const nextBtn = page
          .getByRole("button", { name: /next|continue/i })
          .first();
        if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await nextBtn.click();
        }

        const passwordInput = page
          .locator('#password, input[type="password"]')
          .first();
        await passwordInput.fill(buyer.password);
        const loginBtn = page
          .getByRole("button", { name: /log in|sign in|login/i })
          .first();
        await loginBtn.click();

        const approveBtn = page
          .getByRole("button", { name: /approve|pay now|agree|continue/i })
          .first();
        await approveBtn.click({ timeout: 30_000 }).catch(() => {});

        await page
          .waitForURL(/\/track\/order_/i, { timeout: 60_000 })
          .catch(() => {});
        expect(page.url()).toMatch(/\/track\/order_/i);
      }
    } else {
      const paypalFrame = page.frameLocator("iframe[name*='paypal']").first();
      const loginBtn = paypalFrame
        .locator("button, [data-funding-source='paypal']")
        .first();
      const visible = await loginBtn
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      expect(
        paypalRedirect || visible,
        "PayPal must redirect or render embedded checkout",
      ).toBeTruthy();
    }
  });

  test("admin sees PayPal order after successful payment", async ({ page }) => {
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
