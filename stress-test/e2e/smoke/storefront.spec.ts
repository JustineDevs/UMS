import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible, gotoFirstCatalogPdp } from "../helpers/storefront";

test.describe("storefront smoke", () => {
  test("home renders primary brand and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nav-home")).toBeVisible();
    await expect(page.getByTestId("nav-shop").filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId("nav-checkout")).toBeVisible();
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
  });

  test("product PDP loads from catalog (first listed product)", async ({ page }) => {
    const slug = await gotoFirstCatalogPdp(page);
    if (!slug) {
      test.skip(
        true,
        "No products in Medusa for this region. Run: pnpm --filter medusa seed && pnpm --filter medusa seed:ph (ensure NEXT_PUBLIC_MEDUSA_REGION_ID matches the PH region).",
      );
    }
    const addBtn = page.getByTestId("pdp-add-to-bag");
    await expect(addBtn).toBeVisible({ timeout: 30_000 });
    await expect(addBtn).not.toContainText("Loading", { timeout: 45_000 });
    await expect(addBtn).toBeEnabled({ timeout: 45_000 });
  });

});
