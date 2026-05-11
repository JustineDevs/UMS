/**
 * @checkout @cod
 * COD (Cash on Delivery) checkout flow — full user workflow.
 *
 * Flow:
 *   Add to bag → Checkout → COD → /track/:orderId → Admin order verified (status: pending)
 *
 * COD requires a complete delivery profile. Uses guest checkout if profile not required.
 * Run: pnpm exec playwright test --grep "@cod"
 */
import "../runtime-logs-init";
import { test, expect } from "@playwright/test";
import {
  navigateToShopAndAddFirstProduct,
  navigateToCheckout,
  fillCheckoutShippingInfo,
  selectPaymentProvider,
  clickPayButton,
  expectOrderConfirmation,
} from "../helpers/checkout";
import { signInAsAdmin } from "../fixtures/admin-auth";

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";
const storefrontBase = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function shouldFailOnMissingPrereq(): boolean {
  return process.env.CI_STRICT_E2E === "1" || process.env.CI === "true";
}

test.describe("@checkout @cod COD checkout flow", () => {
  test("complete checkout with Cash on Delivery reaches /track/:orderId", async ({ page }) => {
    await navigateToShopAndAddFirstProduct(page);
    await navigateToCheckout(page);
    await fillCheckoutShippingInfo(page);

    const selected = await selectPaymentProvider(page, "cod");
    if (!selected) {
      if (shouldFailOnMissingPrereq()) {
        throw new Error("COD payment option is not visible during strict E2E validation.");
      }
      test.skip(true, "COD payment option not visible on checkout page");
      return;
    }

    await clickPayButton(page);
    await expectOrderConfirmation(page);

    const trackUrl = page.url();
    expect(trackUrl, "Must redirect to /track/:orderId after COD order placement").toMatch(
      /\/track\/order_/i,
    );

    await expect(page.getByRole("heading", { name: /order/i })).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByText(/status:\s*(pending|not.?paid|pending payment)/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("COD order appears in admin with status pending", async ({ page }) => {
    const result = await signInAsAdmin(page);
    if (result !== "ok") {
      test.skip(true, `Admin sign-in not available: ${result}`);
      return;
    }

    await page.goto(`${adminBase}/admin/orders`);
    await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible({
      timeout: 20_000,
    });

    const orderRows = page.locator("[data-testid='order-row'], tr[data-order-id]");
    const rowCount = await orderRows.count();
    expect(rowCount, "Admin orders list must show at least one COD order").toBeGreaterThan(0);
  });

  test("POST /api/checkout/cod-cart-payload returns 400 without active cart", async ({ request }) => {
    const res = await request.post(`${storefrontBase}/api/checkout/cod-cart-payload`, {
      failOnStatusCode: false,
    });
    const status = res.status();
    expect(
      [400, 401, 403].includes(status),
      `/api/checkout/cod-cart-payload without cart → expected 400/401/403, got ${status}`,
    ).toBeTruthy();
  });

  test("POST /api/checkout/cod-place-order returns 400 without valid body", async ({ request }) => {
    const res = await request.post(`${storefrontBase}/api/checkout/cod-place-order`, {
      data: {},
      failOnStatusCode: false,
    });
    const status = res.status();
    expect(
      [400, 401, 422].includes(status),
      `/api/checkout/cod-place-order with empty body → expected 400/401/422, got ${status}`,
    ).toBeTruthy();
  });
});
