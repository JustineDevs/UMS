import { expect, test } from "@playwright/test";
import { e2eAdminLogin } from "../helpers/admin-e2e-auth";

test.describe("Authenticated wishlist browser flow", () => {
  test("saves a catalog product, persists it, and adds it to the bag", async ({ page }) => {
    const login = await e2eAdminLogin(page);
    test.skip(login !== "ok", "A real local E2E session is required for wishlist proof.");

    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/shop(?:\?.*)?$/);
    const product = page.locator("a[data-product-slug]").first();
    await expect(product).toBeVisible({ timeout: 30_000 });
    const slug = await product.getAttribute("data-product-slug");
    expect(slug).toBeTruthy();
    await product.click();
    await page.waitForURL(new RegExp(`/shop/${slug}`), { timeout: 30_000 });

    const save = page.getByRole("button", { name: "Save item to your list" });
    const wishlistResponse = page.waitForResponse(
      (response) => response.url().includes("/api/wishlist") && response.request().method() === "POST",
    );
    await save.click();
    expect((await wishlistResponse).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Remove from saved items" })).toHaveAttribute("aria-pressed", "true");

    await page.goto("/wishlist", { waitUntil: "domcontentloaded" });
    const onboardingName = page.locator('input[name="name"]');
    const savedItem = page.locator(`a[href="/shop/${slug}"]`).first();
    await Promise.race([
      onboardingName.waitFor({ state: "visible", timeout: 15_000 }),
      savedItem.waitFor({ state: "visible", timeout: 15_000 }),
    ]);
    if (await onboardingName.isVisible().catch(() => false)) {
      await onboardingName.fill("Justine Devs (Official)");
      await page.locator('input[name="tel"]').fill("09637628097");
      await page.locator("#shipping-line1").fill("123 Test Street");
      await page.locator("#shipping-region").selectOption({ index: 1 });
      await expect(page.locator("#shipping-province option")).not.toHaveCount(1, { timeout: 10_000 });
      await page.locator("#shipping-province").selectOption({ index: 1 });
      await expect(page.locator("#shipping-city option")).not.toHaveCount(1, { timeout: 10_000 });
      await page.locator("#shipping-city").selectOption({ index: 1 });
      await expect(page.locator("#shipping-barangay option")).not.toHaveCount(1, { timeout: 10_000 });
      await page.locator("#shipping-barangay").selectOption({ index: 1 });
      await page.getByTestId("checkout-onboarding-continue").click();
      await page.waitForTimeout(500);
      const profileStatus = await page.evaluate(async () => {
        const response = await fetch("/api/account/profile/status", { cache: "no-store" });
        return { status: response.status, body: await response.json() };
      });
      expect(profileStatus).toMatchObject({ status: 200, body: { complete: true } });
      await expect(page).toHaveURL(/\/wishlist$/);
    }
    const remoteWishlist = await page.evaluate(async () => {
      const response = await fetch("/api/wishlist", { cache: "no-store" });
      return { status: response.status, body: await response.json() };
    });
    expect(remoteWishlist.status).toBe(200);
    expect(remoteWishlist.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_slug: slug }),
      ]),
    );
    await expect(savedItem).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/shop/${slug}"]`).first()).toBeVisible();

    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("status")).toContainText("added to bag", { timeout: 10_000 });
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/shop/${slug}"]`).first()).toBeVisible();
  });
});
