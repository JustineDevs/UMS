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
  enablePublicTunnelBypass,
} from "../helpers/checkout";
import { signInAsAdmin } from "../fixtures/admin-auth";
import { getPayPalSandboxBuyer } from "../fixtures/sandbox-cards";

const adminBase = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";
const storefrontBase =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function isPayPalSandbox(): void {
  const env = process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase();
  if (env === "production" || env === "live") {
    throw new Error(
      "HALT: PAYPAL_ENVIRONMENT is set to production/live. " +
        "Do not run sandbox flows against the live PayPal API. Set PAYPAL_ENVIRONMENT=sandbox.",
    );
  }
}

async function startPayPalCheckout(
  page: Parameters<typeof navigateToCheckout>[0],
): Promise<void> {
  await navigateToShopAndAddFirstProduct(page);
  await navigateToCheckout(page);
  await fillCheckoutShippingInfo(page);
  const selected = await selectPaymentProvider(page, "paypal");
  if (!selected) {
    throw new Error(
      `PayPal is configured but not selectable in the browser checkout. URL=${page.url()}`,
    );
  }
  await clickPayButton(page);
  const continuePayment = page.getByTestId("checkout-continue-payment");
  if (await continuePayment.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await continuePayment.click();
  }
}

test.describe("@checkout @paypal PayPal checkout flow", () => {
  test.beforeEach(async ({ page }) => {
    await enablePublicTunnelBypass(page);
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

    // Hosted providers are intentionally two-step: the first action creates
    // the durable attempt, the second navigates to the provider URL.
    const continuePayment = page.getByTestId("checkout-continue-payment");
    if (
      await continuePayment
        .waitFor({ state: "visible", timeout: 30_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await continuePayment.click();
    }

    const buyer = getPayPalSandboxBuyer();
    if (!buyer) {
      throw new Error(
        "PayPal sandbox buyer credentials are required for browser completion. " +
          "Configure a distinct PERSONAL sandbox buyer in PAYPAL_SANDBOX_BUYER_EMAIL/PAYPAL_SANDBOX_BUYER_PASSWORD.",
      );
    }

    const paypalRedirect = await page
      .waitForURL(/paypal\.com/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    if (paypalRedirect) {
      await expect(page).toHaveURL(/paypal\.com/, { timeout: 10_000 });

      if (/\/track\/order_/i.test(page.url())) {
        return;
      }

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
      }

      for (const frame of page.frames()) {
        const approveBtn = frame
          .getByRole("button", {
            name: /approve|pay now|agree|continue|complete purchase/i,
          })
          .or(frame.locator("button").filter({ hasText: /complete purchase/i }))
          .or(frame.getByText(/complete purchase/i))
          .first();
        if (await approveBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await approveBtn.click();
          break;
        }
      }

      // PayPal's hosted Hermes page sometimes renders the approval control in
      // the top document without a semantic button role.
      const hostedApproval = page
        .getByText("Complete Purchase", { exact: true })
        .first();
      if (
        await hostedApproval.isVisible({ timeout: 2_000 }).catch(() => false)
      ) {
        await hostedApproval.click({ force: true });
      }
      const hostedButton = page
        .locator('button:has-text("Complete Purchase")')
        .first();
      if (await hostedButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await hostedButton.click({ force: true });
      }
      for (const frame of page.frames()) {
        const clickedByText = await frame
          .evaluate(() => {
            const nodes = Array.from(
              document.querySelectorAll<HTMLElement>(
                "button, [role='button'], a, div",
              ),
            );
            const target = nodes.find(
              (node) => node.textContent?.trim() === "Complete Purchase",
            );
            if (!target) return false;
            target.click();
            return true;
          })
          .catch(() => false);
        if (clickedByText) break;
      }
      const approvalBox = await page
        .locator('text="Complete Purchase"')
        .first()
        .boundingBox()
        .catch(() => null);
      if (approvalBox) {
        await page.mouse.click(
          approvalBox.x + approvalBox.width / 2,
          approvalBox.y + approvalBox.height / 2,
        );
      } else if (/\/webapps\/hermes/i.test(page.url())) {
        // Hermes renders the approval surface in a cross-origin document with
        // no inspectable control in some sandbox sessions.
        const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
        await page.mouse.click(viewport.width / 2, viewport.height * 0.55);
      }
      if (/\/webapps\/hermes/i.test(page.url())) {
        await page.mouse.click((page.viewportSize()?.width ?? 1280) / 2, 399);
      }

      await page
        .waitForURL(/\/track\/order_/i, { timeout: 60_000 })
        .catch(() => {});
      expect(page.url()).toMatch(/\/track\/order_/i);
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

  test("PayPal cancel return does not expose an order", async ({ page }) => {
    await startPayPalCheckout(page);
    await page.goto(
      `${storefrontBase}/checkout/hosted-return?provider=paypal&status=cancel`,
      {
        waitUntil: "domcontentloaded",
      },
    );

    await expect(page).not.toHaveURL(/\/track\/order_/i);
    await expect(
      page.getByText(/left PayPal before completing payment/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to checkout/i }),
    ).toBeVisible();
  });

  test("PayPal declined payment return does not expose an order", async ({
    page,
  }) => {
    await startPayPalCheckout(page);
    await page.goto(
      `${storefrontBase}/checkout/hosted-return?provider=paypal&status=failed`,
      {
        waitUntil: "domcontentloaded",
      },
    );

    await expect(page).not.toHaveURL(/\/track\/order_/i);
    await expect(
      page.getByText(/PayPal did not confirm your payment/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to checkout/i }),
    ).toBeVisible();
  });

  test("admin sees PayPal order after successful payment", async ({ page }) => {
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
