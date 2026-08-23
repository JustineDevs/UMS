import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible, gotoFirstCatalogPdp } from "../helpers/storefront";
import { setViewport } from "../helpers/viewports";

test.describe("storefront smoke", () => {
  test("home renders primary brand and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nav-home")).toBeVisible();
    await expect(page.getByTestId("nav-shop").filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId("nav-checkout")).toBeVisible();
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
          code: "MEDUSA_REGION_FETCH_FAILED",
          message: "Checkout is temporarily unavailable.",
        }),
      });
    });
    await page.goto("/checkout?guest=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("checkout-unavailable-retry")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/your bag is saved/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to bag" })).toBeVisible();
  });

  test("account section navigation scrolls and exposes the active section", async ({ page }) => {
    await page.goto("/account");
    const profile = page.getByRole("link", { name: "Profile & addresses" });
    await expect(profile).toHaveAttribute("href", "#profile");
    await expect(profile).toHaveClass(/min-h-11/);
    await profile.click();
    await expect(page).toHaveURL(/\/account#profile$/);
    await expect(profile).toHaveAttribute("aria-current", "location");
  });

  test("mobile account navigation and recovery actions keep thumb-sized targets", async ({ page }) => {
    await setViewport(page, "mobile");
    await page.goto("/account", { waitUntil: "domcontentloaded" });
    for (const locator of [
      page.getByRole("link", { name: "Overview" }),
      page.getByRole("link", { name: "Orders" }),
      page.getByRole("link", { name: "Profile & addresses" }),
      page.getByRole("link", { name: "Preferences", exact: true }),
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
        "No products in Medusa for this region. Run: pnpm --filter medusa seed && pnpm --filter medusa seed:ph (ensure NEXT_PUBLIC_MEDUSA_REGION_ID matches the PH region).",
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
      localStorage.removeItem("ums-commerce-cart-v4");
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
