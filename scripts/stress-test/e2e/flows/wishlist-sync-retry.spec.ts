import { expect, test } from "@playwright/test";
import { adminBase, e2eAdminLogin } from "../helpers/admin-e2e-auth";

const localWishlistKey = "universal_music_store_wishlist_v1";

test.describe("Wishlist sync recovery", () => {
  test("keeps the local list, exposes retry, and clears the error after recovery", async ({ page }) => {
    const login = await e2eAdminLogin(page);
    test.skip(login !== "ok", "A local authenticated E2E session is required for wishlist sync recovery proof.");

    await page.addInitScript(({ key }) => {
      window.sessionStorage.clear();
      window.localStorage.setItem(
        "universal-music-store-cookie-consent-v1",
        "essential-only",
      );
      window.localStorage.setItem(key, JSON.stringify([
        {
          slug: "local-recovery-item",
          name: "Local recovery item",
          medusaProductId: "prod-local-recovery",
          addedAt: "2026-10-02T00:00:00.000Z",
        },
      ]));
    }, { key: localWishlistKey });

    await page.route("**/api/wishlist", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
    });

    let attempts = 0;
    await page.route("**/api/wishlist/sync", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "temporary_sync_failure" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          items: [{
            product_slug: "local-recovery-item",
            product_name: "Local recovery item",
            medusa_product_id: "prod-local-recovery",
            added_at: "2026-10-02T00:00:00.000Z",
          }],
          skippedProductIds: [],
        }),
      });
    });

    await page.goto(`${adminBase}/wishlist`, { waitUntil: "domcontentloaded" });
    const alert = page.locator('[role="alert"]').filter({ hasText: "Saved items" });
    await expect(alert).toContainText("local list is unchanged", { timeout: 30_000 });
    await alert.getByRole("button", { name: "Retry" }).click({ force: true });
    await expect.poll(() => attempts).toBe(2);
    await expect(alert).toHaveCount(0);
    await expect.poll(async () => page.evaluate((key) => window.localStorage.getItem(key), localWishlistKey)).toContain("prod-local-recovery");
  });
});
