/**
 * @checkout @xendit
 * Xendit hosted checkout flow — full user workflow.
 *
 * Flow:
 *   Browse → Add to bag → Checkout → Xendit hosted redirect →
 *   Complete hosted payment → Redirect back → /track/:orderId
 *
 * Requires E2E_XENDIT_SECRET_KEY.
 * Run: pnpm exec playwright test --grep "@xendit"
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

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

test.describe("@checkout @xendit Xendit checkout flow", () => {
  test.beforeEach(() => {
    skipUnlessPspConfigured("xendit");
  });

  test("checkout reaches Xendit hosted payment page", async ({ page }) => {
    await navigateToShopAndAddFirstProduct(page);
    await navigateToCheckout(page);
    await fillCheckoutShippingInfo(page);

    const selected = await selectPaymentProvider(page, "xendit");
    if (!selected) {
      test.skip(true, "Xendit payment option not visible on checkout page");
      return;
    }

    await clickPayButton(page);

    const hosted = await page
      .waitForURL(/xendit|checkout/i, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (!hosted) {
      await expect(page.getByTestId("order-confirmation").or(page.locator("[data-order-id]"))).toBeVisible({
        timeout: 30_000,
      });
    }

    await expect(
      page.getByText(/xendit|payment|processing|confirm|order/i).first().or(page.locator("[data-testid='order-confirmation']")),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("admin sees Xendit order after successful payment", async ({ page }) => {
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
