import { expect, test } from "@playwright/test";
import { e2eAdminLogin, ensureE2eProfileComplete } from "../helpers/admin-e2e-auth";

test.describe("Authenticated wishlist browser flow", () => {
  test("saves a catalog product, persists it, and adds it to the bag", async ({ page }) => {
    test.skip(process.env.AUTH_DISABLED === "true", "Auth-disabled mode cannot prove real wishlist persistence.");
    const login = await e2eAdminLogin(page);
    test.skip(login !== "ok", "A real local E2E session is required for wishlist proof.");
    await ensureE2eProfileComplete(page, "/wishlist");

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
    const savedItem = page.locator(`a[href="/shop/${slug}"]`).first();
    await expect(savedItem).toBeVisible({ timeout: 30_000 });
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
    await expect(page.locator(`a[href="/shop/${slug}"]`).first()).toBeVisible({
      timeout: 30_000,
    });

    const savedItemRow = page.locator("li").filter({ has: page.locator(`a[href="/shop/${slug}"]`) }).first();
    await savedItemRow.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("status")).toContainText("added to bag", { timeout: 10_000 });
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/shop/${slug}"]`).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
