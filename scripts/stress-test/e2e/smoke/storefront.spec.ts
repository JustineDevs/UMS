import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible, gotoFirstCatalogPdp } from "../helpers/storefront";
import {
  fillCheckoutShippingInfo,
  navigateToCheckout,
  clickPayButton,
  selectPaymentProvider,
} from "../helpers/checkout";
import { setViewport } from "../helpers/viewports";

test.describe("storefront smoke", () => {
  async function requireAuthenticatedAccount(page: import("@playwright/test").Page): Promise<boolean> {
    await page.goto("/account", { waitUntil: "domcontentloaded" });
    if (/\/sign-in(?:\?|$)/i.test(page.url())) {
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      return false;
    }
    return true;
  }

  test("home renders primary brand and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nav-home")).toBeVisible();
    await expect(page.getByTestId("nav-shop").filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId("nav-checkout")).toBeVisible();
  });

  test("primary navigation does not expose collections", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Collections", exact: true })).toHaveCount(0);
  });

  test("home does not render the retired category or newsletter sections", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-cms-id="home-tiles"]')).toHaveCount(0);
    await expect(page.locator("#join-club")).toHaveCount(0);
  });

  test("footer uses the commerce layout without the newsletter block", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await expect(page.locator("footer")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Keep up to date with our quarterly newsletter/i)).toHaveCount(0);
  });

  test("about route is a dedicated navigable storefront surface", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /music gear that earns its place/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "About" }).first()).toHaveAttribute("href", "/about");
  });

  test("shop lists products or empty state", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("checkout page loads and shows empty bag by default", async ({
    page,
  }) => {
    await page.goto("/checkout");
    await expectCheckoutShellVisible(page);
    const guest = page.getByTestId("checkout-guest-sign-in");
    const pay = page.getByTestId("checkout-submit-pay");
    const onboard = page.getByTestId("checkout-onboarding-continue");
    if (await guest.isVisible()) {
      await expect(pay).toHaveCount(0);
      return;
    }
    if (await onboard.isVisible()) {
      await expect(pay).toHaveCount(0);
      return;
    }
    await expect(pay).toBeVisible();
    await expect(pay).toBeDisabled();
    await expect(page.getByTestId("checkout-phase")).toHaveText("Checkout ready.");
  });

  test("mobile checkout primary actions remain thumb-sized", async ({ page }) => {
    await setViewport(page, "mobile");
    await page.goto("/checkout?guest=1", { waitUntil: "domcontentloaded" });
    const actions = page.getByTestId("checkout-submit-pay").or(page.getByTestId("checkout-unavailable-retry"));
    await expect(actions.first()).toBeVisible({ timeout: 15_000 });
    expect(await actions.first().evaluate((node) => Math.round(node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    const bag = page.getByRole("link", { name: /back to bag|review bag/i }).first();
    if (await bag.isVisible()) {
      expect(await bag.evaluate((node) => Math.round(node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    }
  });

  test("checkout fails closed and preserves bag access when providers are unavailable", async ({ page }) => {
    await page.route("**/api/checkout/available-payment-methods", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          keys: [],
          code: "WORKER_PAYMENT_METHODS_UNAVAILABLE",
          message: "Checkout is temporarily unavailable.",
        }),
      });
    });
    await page.goto("/checkout?guest=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("checkout-unavailable-retry")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/your bag is saved/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to bag" })).toBeVisible();
  });

  test("provider startup exposes an accessible phase announcement on failure", async ({ page }) => {
    let releaseStart!: () => void;
    let startRequests = 0;
    const startRelease = new Promise<void>((resolve) => {
      releaseStart = resolve;
    });
    await page.route("**/api/checkout/start", async (route) => {
      startRequests += 1;
      await startRelease;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Payment provider is temporarily unavailable." }),
      });
    });
    await page.route("**/api/checkout/available-payment-methods", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, keys: ["STRIPE", "PAYPAL", "XENDIT", "COD"] }),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem(
        "ums-commerce-cart-v5",
        JSON.stringify([
          {
            variantId: "provider-phase-fixture",
            quantity: 1,
            name: "Provider phase fixture",
            slug: "provider-phase-fixture",
            sku: "PROVIDER-PHASE",
            type: "Default",
            finish: "",
            price: 100,
          },
        ]),
      );
    });
    await page.route("**/api/checkout/preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cartId: "phase-cart",
          subtotal: 100,
          taxTotal: 12,
          shippingTotal: 0,
          discountTotal: 0,
          total: 112,
          currencyCode: "PHP",
          lineSubtotalsByVariantId: { "provider-phase-fixture": 100 },
          quoteFingerprint: "phase-quote",
          variantIds: ["provider-phase-fixture"],
          productIds: ["provider-phase-product"],
          shippingMethodIds: [],
          regionId: "phase-region",
          shippingOptions: [],
          appliedShippingOptionId: null,
        }),
      });
    });
    await navigateToCheckout(page, { guest: true });
    await fillCheckoutShippingInfo(page);
    await expect(page.getByText("Secure hosted card checkout opens in this tab.")).toBeVisible();
    await expect(page.getByText("Approve in PayPal's secure checkout window.")).toBeVisible();
    await expect(page.getByText("Use hosted checkout or choose GCash and bank transfer when available.")).toBeVisible();
    await expect(page.getByText("Place the order now and pay the rider in Philippine pesos.")).toBeVisible();
    expect(await selectPaymentProvider(page, "stripe")).toBe(true);
    await fillCheckoutShippingInfo(page);

    const phase = page.getByTestId("checkout-phase");
    await expect(phase).toHaveText("Checkout ready.");
    const terms = page.getByTestId("checkout-terms-checkbox");
    if (await terms.isVisible().catch(() => false)) {
      await terms.check();
    }
    const review = page.getByRole("button", {
      name: /reviewed the updated total/i,
    });
    if (await review.isVisible().catch(() => false)) {
      await review.click();
    }
    const pay = page.getByTestId("checkout-submit-pay");
    await expect(pay).toBeEnabled({ timeout: 30_000 });
    await pay.dblclick();
    await expect(phase).toHaveText("Preparing secure checkout.");
    expect(startRequests).toBe(1);
    releaseStart();
    await expect(phase).toHaveText("Checkout could not continue. Review the error and try again.", {
      timeout: 15_000,
    });
    await expect(page.getByText("Payment provider is temporarily unavailable.")).toBeVisible();
  });

  test("invalid hosted provider actions fail closed in the browser", async ({ page }) => {
    await page.route("**/api/checkout/available-payment-methods", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, keys: ["STRIPE", "COD"] }),
      });
    });
    await page.route("**/api/checkout/preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cartId: "invalid-action-cart",
          subtotal: 100,
          taxTotal: 12,
          shippingTotal: 0,
          discountTotal: 0,
          total: 112,
          currencyCode: "PHP",
          lineSubtotalsByVariantId: { "invalid-action-fixture": 100 },
          quoteFingerprint: "invalid-action-quote",
          variantIds: ["invalid-action-fixture"],
          productIds: ["invalid-action-product"],
          shippingMethodIds: [],
          regionId: "invalid-action-region",
          shippingOptions: [],
          appliedShippingOptionId: null,
        }),
      });
    });
    await page.route("**/api/checkout/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cartId: "invalid-action-cart",
          trackingPageUrl: "/track/order-invalid-action",
          correlationId: "invalid-action-correlation",
          checkoutUrl: "https://evil.example/checkout",
          providerLabel: "Stripe",
          confirmedTotal: 112,
          currencyCode: "PHP",
          quoteFingerprint: "invalid-action-quote",
          variantIds: ["invalid-action-fixture"],
          productIds: ["invalid-action-product"],
          checkoutActionKind: "redirect",
        }),
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "ums-commerce-cart-v5",
        JSON.stringify([
          {
            variantId: "invalid-action-fixture",
            quantity: 1,
            name: "Invalid action fixture",
            slug: "invalid-action-fixture",
            sku: "INVALID-ACTION",
            type: "Default",
            finish: "",
            price: 100,
          },
        ]),
      );
    });

    await navigateToCheckout(page, { guest: true });
    await fillCheckoutShippingInfo(page);
    expect(await selectPaymentProvider(page, "stripe")).toBe(true);
    await fillCheckoutShippingInfo(page);
    await clickPayButton(page);

    await expect(page.getByTestId("checkout-phase")).toHaveText(
      "Checkout could not continue. Review the error and try again.",
      { timeout: 15_000 },
    );
    await expect(page).toHaveURL(/\/checkout\?guest=1/);
    await expect(page.getByText(/invalid checkout link|payment provider returned/i)).toBeVisible();
  });

  test("account navigation exposes dedicated account routes", async ({ page }) => {
    if (!(await requireAuthenticatedAccount(page))) {
      test.skip(true, "Account navigation requires a real authenticated storefront session.");
      return;
    }
    const profile = page.getByRole("link", { name: "Profile", exact: true }).first();
    await expect(profile).toHaveAttribute("href", "/account/profile");
    await expect(profile).toHaveClass(/min-h-11/);
    await profile.click();
    await expect(page).toHaveURL(/\/account\/profile$/);
    await expect(profile).toHaveAttribute("aria-current", "page");
  });

  test("mobile account navigation and recovery actions keep thumb-sized targets", async ({ page }) => {
    await setViewport(page, "mobile");
    if (!(await requireAuthenticatedAccount(page))) {
      test.skip(true, "Account navigation requires a real authenticated storefront session.");
      return;
    }
    for (const locator of [
      page.getByRole("link", { name: "Profile", exact: true }).first(),
      page.getByRole("link", { name: "Purchase History", exact: true }),
      page.getByRole("link", { name: "Addresses", exact: true }),
      page.getByRole("link", { name: "Order Settings", exact: true }),
      page.getByRole("link", { name: /Open full settings/ }),
      page.getByRole("button", { name: "Track order" }),
    ]) {
      await expect(locator).toBeVisible();
      expect(await locator.evaluate((node) => Math.round(node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    }
    const authAction = page.locator('button:has-text("Sign out"), [aria-label="Account links"] a:has-text("Sign in")').first();
    await expect(authAction).toBeVisible();
    expect(await authAction.evaluate((node) => Math.round(node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
  });

  test("tracking recovery action is thumb-sized on mobile", async ({ page }) => {
    await setViewport(page, "mobile");
    await page.goto("/track/order_missing", { waitUntil: "domcontentloaded" });
    const shop = page.getByRole("link", { name: "Continue shopping" });
    await expect(shop).toBeVisible();
    expect(await shop.evaluate((node) => Math.round(node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
  });

  test("product PDP loads from catalog (first listed product)", async ({ page }) => {
    const slug = await gotoFirstCatalogPdp(page);
    if (!slug) {
      test.skip(
        true,
        "No published products are available from the Worker catalog. Seed the configured commerce database and verify Worker catalog/region settings.",
      );
    }
    const addBtn = page.locator('[data-testid="pdp-add-to-bag"]:visible').first();
    await expect(addBtn).toBeVisible({ timeout: 30_000 });
    await expect(addBtn).not.toContainText("Loading", { timeout: 45_000 });
    await expect(addBtn).toBeEnabled({ timeout: 45_000 });
  });

  test("PDP add-to-bag starts a new line at quantity one", async ({ page }) => {
    const slug = await gotoFirstCatalogPdp(page);
    if (!slug) {
      test.skip(true, "No seeded catalog product available");
      return;
    }
    await page.evaluate(() => {
      localStorage.removeItem("ums-commerce-cart-v3");
      localStorage.removeItem("ums-commerce-cart-v5");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const addBtn = page.locator('[data-testid="pdp-add-to-bag"]:visible').first();
    try {
      await addBtn.waitFor({ state: "visible", timeout: 45_000 });
    } catch {
      test.skip(true, "Selected seeded product has no sellable variant for the add-to-bag regression.");
      return;
    }
    await expect(addBtn).toBeEnabled({ timeout: 45_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("spinbutton", { name: /quantity for/i }).first()).toHaveValue("1");

    await page.goto(`/shop/${slug}`, { waitUntil: "domcontentloaded" });
    const secondAddBtn = page.locator('[data-testid="pdp-add-to-bag"]:visible').first();
    await expect(secondAddBtn).toBeEnabled({ timeout: 45_000 });
    await secondAddBtn.click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("spinbutton", { name: /quantity for/i }).first()).toHaveValue("2");
  });

});
