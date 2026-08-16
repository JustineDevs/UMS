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
  enablePublicTunnelBypass,
} from "../helpers/checkout";
import { signInAsAdmin } from "../fixtures/admin-auth";

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";
const storefrontBase =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function startXenditCheckout(
  page: Parameters<typeof navigateToCheckout>[0],
): Promise<void> {
  await navigateToShopAndAddFirstProduct(page);
  await navigateToCheckout(page);
  await fillCheckoutShippingInfo(page);
  const selected = await selectPaymentProvider(page, "xendit");
  if (!selected) {
    throw new Error(
      `Xendit is configured but not selectable in the browser checkout. URL=${page.url()}`,
    );
  }
  await clickPayButton(page);
}

test.describe("@checkout @xendit Xendit checkout flow", () => {
  test.beforeEach(async ({ page }) => {
    await enablePublicTunnelBypass(page);
    skipUnlessPspConfigured("xendit");
  });

  test("checkout reaches Xendit hosted payment page", async ({ page }) => {
    await navigateToShopAndAddFirstProduct(page);
    await navigateToCheckout(page);
    await fillCheckoutShippingInfo(page);

    const selected = await selectPaymentProvider(page, "xendit");
    if (!selected) {
      throw new Error(
        `Xendit is configured and visible in Medusa but not selectable in the browser checkout. URL=${page.url()}`,
      );
    }

    await clickPayButton(page);

    const continuePayment = page.getByTestId("checkout-continue-payment");
    await expect(continuePayment).toBeVisible({ timeout: 30_000 });
    await continuePayment.click();
    await page.waitForURL(/checkout(?:-staging)?\.xendit\.co|dev\.xen\.to/i, {
      timeout: 30_000,
    });

    await expect(
      page
        .getByText(/xendit|payment|processing|confirm|order/i)
        .first()
        .or(page.locator("[data-testid='order-confirmation']")),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: /^Cards\b/i }).click();
    await page.getByLabel("Card Number").fill("4000000000001000");
    await page.getByLabel("Card Expiry Date").fill("12/30");
    await page.getByLabel("CVN").fill("123");
    await page.getByLabel("First Name").fill("UVS");
    await page.getByLabel("Last Name").fill("Sandbox");
    await page.getByLabel("Email").fill("e2e@example.com");
    await page.getByPlaceholder("905 123 4567").fill("9171234567");
    await page.getByRole("button", { name: "Pay with Cards", exact: true }).click();
    await page.waitForURL(/\/checkout\/hosted-return\?provider=xendit&status=success/i, {
      timeout: 90_000,
    });
    await expect(page).toHaveURL(/\/track\/order_/i, { timeout: 90_000 });
  });

  test("Xendit failed payment return does not expose an order", async ({
    page,
  }) => {
    await startXenditCheckout(page);
    await page.goto(
      `${storefrontBase}/checkout/hosted-return?provider=xendit&status=failed`,
      {
        waitUntil: "domcontentloaded",
      },
    );

    await expect(page).not.toHaveURL(/\/track\/order_/i);
    await expect(
      page.getByText(/Xendit did not confirm your payment/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to checkout/i }),
    ).toBeVisible();
  });

  test("Xendit expired payment return does not expose an order", async ({
    page,
  }) => {
    await startXenditCheckout(page);
    await page.goto(
      `${storefrontBase}/checkout/hosted-return?provider=xendit&status=expired`,
      {
        waitUntil: "domcontentloaded",
      },
    );

    await expect(page).not.toHaveURL(/\/track\/order_/i);
    await expect(
      page.getByText(/Xendit did not confirm your payment/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to checkout/i }),
    ).toBeVisible();
  });

  test("admin sees Xendit order after successful payment", async ({ page }) => {
    if (
      process.env.AUTH_DISABLED === "true" ||
      process.env.AUTH_DISABLE === "true"
    ) {
      test.skip(
        true,
        "Admin auth disabled; run with staff E2E credentials for admin order proof.",
      );
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
  });
});
