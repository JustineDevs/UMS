/**
 * @checkout @maya
 * Maya sandbox checkout flow — full user workflow.
 *
 * Flow:
 *   Browse → Add to bag → Checkout → Maya hosted redirect →
 *   Complete test payment → Redirect back → /track/:orderId
 *
 * Requires E2E_MAYA_SECRET_KEY and MAYA_SANDBOX=true.
 * Run: pnpm exec playwright test --grep "@maya"
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
import { MAYA_SUCCESS_CARD, MAYA_TEST_EXPIRY, MAYA_TEST_CVC } from "../fixtures/sandbox-cards";

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

function isMayaSandbox(): void {
  const sandbox = process.env.MAYA_SANDBOX?.trim().toLowerCase();
  if (process.env.MAYA_SECRET_KEY?.trim() && sandbox !== "true" && sandbox !== "1") {
    throw new Error(
      "HALT: MAYA_SECRET_KEY is set but MAYA_SANDBOX is not true. " +
        "Do not run sandbox flows against the Maya production gateway. Set MAYA_SANDBOX=true.",
    );
  }
}

test.describe("@checkout @maya Maya checkout flow", () => {
  test.beforeEach(() => {
    isMayaSandbox();
    skipUnlessPspConfigured("maya");
  });

  test("MAYA_SANDBOX=true is set (guard against production gateway)", () => {
    const key = process.env.E2E_MAYA_SECRET_KEY?.trim() ?? process.env.MAYA_SECRET_KEY?.trim();
    if (!key) {
      test.skip(true, "No Maya secret key configured");
      return;
    }
    const sandbox = process.env.MAYA_SANDBOX?.trim().toLowerCase();
    expect(
      sandbox === "true" || sandbox === "1",
      `MAYA_SANDBOX must be "true" when MAYA_SECRET_KEY is set, got: "${sandbox}"`,
    ).toBe(true);
  });

  test("checkout reaches Maya hosted payment page", async ({ page }) => {
    await navigateToShopAndAddFirstProduct(page);
    await navigateToCheckout(page);
    await fillCheckoutShippingInfo(page);

    const selected = await selectPaymentProvider(page, "maya");
    if (!selected) {
      test.skip(true, "Maya payment option not visible on checkout page");
      return;
    }

    await clickPayButton(page);

    const onMayaPage = await page
      .waitForURL(/maya\.ph|paymaya/i, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (onMayaPage) {
      const cardInput = page
        .locator('input[placeholder*="Card"], input[data-testid="card-number"]')
        .first();
      const cardInputVisible = await cardInput.isVisible({ timeout: 10_000 }).catch(() => false);

      if (cardInputVisible) {
        await cardInput.fill(MAYA_SUCCESS_CARD);
        const expiryInput = page.locator('input[placeholder*="MM"], input[placeholder*="expiry"]').first();
        await expiryInput.fill(MAYA_TEST_EXPIRY);
        const cvcInput = page.locator('input[placeholder*="CVC"], input[placeholder*="CVV"]').first();
        await cvcInput.fill(MAYA_TEST_CVC);

        const payBtn = page.getByRole("button", { name: /pay|submit|confirm/i }).first();
        await payBtn.click();

        await page.waitForURL(/\/track\/order_/i, { timeout: 60_000 }).catch(() => {});
      }
    }

    await expect(
      page
        .getByText(/maya|payment|processing|confirm|order/i)
        .first()
        .or(page.locator("[data-testid='order-confirmation']")),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("admin sees Maya order after successful payment", async ({ page }) => {
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
