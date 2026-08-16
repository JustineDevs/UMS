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
let createdCodOrderId: string | null = null;

function shouldFailOnMissingPrereq(): boolean {
  return process.env.CI_STRICT_E2E === "1" || process.env.CI === "true";
}

test.describe("@checkout @cod COD checkout flow", () => {
  test.describe.configure({ mode: "serial" });

  test("complete checkout with Cash on Delivery reaches /track/:orderId", async ({ page }) => {
    if (process.env.AUTH_DISABLED === "true") {
      const profile = await page.request.patch(`${storefrontBase}/api/account/profile`, {
        data: {
          displayName: "E2E Tester",
          phone: "+639171234567",
          shippingAddresses: [
            {
              fullName: "E2E Tester",
              line1: "123 Test Street",
              city: "Manila",
              postalCode: "1000",
              barangay: "Barangay Test",
              province: "Metro Manila",
              country: "PH",
              phone: "+639171234567",
            },
          ],
        },
        failOnStatusCode: false,
      });
      expect(profile.status(), "local auth-disabled profile seed").toBe(200);
    }
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
    createdCodOrderId = trackUrl.match(/(order_[a-z0-9]+)/i)?.[1] ?? null;

    await expect(page.getByRole("heading", { name: /order/i })).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByText(/status:\s*(pending|not.?paid|pending payment)/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("COD order appears in admin with status pending", async ({ page }) => {
    if (process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLE === "true") {
      test.skip(true, "Admin auth disabled; run with staff E2E credentials for admin order proof.");
      return;
    }
    if (!createdCodOrderId) {
      test.skip(true, "COD order id was not captured from the checkout flow");
      return;
    }

    const result = await signInAsAdmin(page);
    if (result !== "ok") {
      test.skip(true, `Admin sign-in not available: ${result}`);
      return;
    }

    await page.goto(`${adminBase}/admin/orders/${encodeURIComponent(createdCodOrderId)}`);
    await expect(
      page.getByRole("heading", { name: /^order\s+\d+$/i })
        .or(page.getByRole("heading", { name: /^\d+$/ }))
        .or(page.getByRole("heading", { name: /order/i })),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("pending", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("POST /api/checkout/cod-cart-payload returns the verified delivery profile", async ({ request }) => {
    const res = await request.post(`${storefrontBase}/api/checkout/cod-cart-payload`, {
      failOnStatusCode: false,
    });
    const status = res.status();
    expect(status, "/api/checkout/cod-cart-payload with a complete local profile").toBe(200);
    const body = (await res.json()) as { email?: string; shipping_address?: unknown; billing_address?: unknown };
    expect(body.email).toBeTruthy();
    expect(body.shipping_address).toBeTruthy();
    expect(body.billing_address).toBeTruthy();
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
