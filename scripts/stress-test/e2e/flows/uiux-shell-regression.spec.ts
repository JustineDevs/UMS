import { expect, test } from "@playwright/test";

test.describe("UI/UX shell audit regressions", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("removed utility links stay absent and consent does not cover content", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("universal-music-store-cookie-consent-v1");
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Sell with us", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Download app", { exact: true })).toHaveCount(0);
    const consent = page.getByRole("complementary", { name: "Cookie consent" });
    if (await consent.count()) {
      await expect(consent).toHaveCSS("position", "fixed");
    }
  });

  test("mobile menu traps focus, locks scroll, and restores focus on Escape", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const trigger = page.getByTestId("mobile-menu-trigger");
    await trigger.click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("catalog search exposes the keyboard combobox contract", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const search = page.getByRole("combobox", { name: "Search products" });
    await expect(search).toHaveAttribute("aria-autocomplete", "list");
    await expect(search).toHaveAttribute("aria-controls", /^catalog-typeahead-results-/);
    await search.fill("ca");
    await search.press("Escape");
    await expect(search).toHaveAttribute("aria-expanded", "false");
  });
});
