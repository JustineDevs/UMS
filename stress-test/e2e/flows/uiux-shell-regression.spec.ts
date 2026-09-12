import { expect, test } from "@playwright/test";

test.describe("UI/UX shell audit regressions", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("utility links stay on one row and consent does not cover content", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("universal-music-store-cookie-consent-v1");
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const utility = page.locator(".bg-primary .overflow-x-auto");
    await expect(utility).toBeVisible();
    const linkTops = await utility.locator("a").evaluateAll((links) =>
      links.map((link) => Math.round(link.getBoundingClientRect().top)),
    );
    expect(new Set(linkTops).size).toBe(1);
    await expect(page.getByRole("dialog", { name: "Cookie consent" })).toHaveCSS(
      "position",
      "fixed",
    );
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
    await expect(search).toHaveAttribute("aria-controls", "catalog-typeahead-results");
    await search.fill("ca");
    await search.press("Escape");
    await expect(search).toHaveAttribute("aria-expanded", "false");
  });
});
