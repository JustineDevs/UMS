import { test, expect } from "@playwright/test";

import { gotoFirstCatalogPdp } from "../helpers/storefront";
import { setViewport } from "../helpers/viewports";

test.describe("storefront UX and compliance", () => {
  test("mobile navigation is a keyboard-operable dialog", async ({ page }) => {
    await setViewport(page, "mobile");
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const trigger = page.getByTestId("mobile-menu-trigger");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.focus();
    await trigger.press("Enter");

    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("public policy pages expose version and effective date", async ({ page }) => {
    for (const path of ["/privacy", "/terms", "/cookies", "/accessibility"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-policy-version]")).toHaveAttribute(
        "data-policy-effective-date",
        /^20\d\d-\d\d-\d\d$/,
      );
      await expect(page.getByText(/Version 2026\.08/)).toBeVisible();
    }
  });

  test("search combobox supports active descendant and keyboard selection", async ({ page }) => {
    await page.route("**/api/shop/search-suggest**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ suggestions: [{ slug: "canary", name: "Canary", minPrice: 1999 }] }),
      }),
    );
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const input = page.locator("#catalog-typeahead");
    await input.fill("ca");
    const option = page.getByRole("option", { name: /Canary/ });
    await expect(option).toBeVisible();
    await input.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-activedescendant", "catalog-suggestion-0");
    await input.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("generated sitemap exposes public routes", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBeTruthy();
    const xml = await response.text();
    for (const path of ["/shop", "/collections", "/privacy", "/terms", "/accessibility"]) {
      expect(xml).toContain(path);
    }
  });

  test("hosted provider cancel and failure returns never expose an order", async ({ page }) => {
    for (const provider of ["stripe", "paypal", "xendit"]) {
      for (const status of ["cancel", "failed", "expired"]) {
        await page.goto(`/checkout/hosted-return?provider=${provider}&status=${status}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page).not.toHaveURL(/\/track\/order_/i);
        await expect(page.getByText(/return to checkout|try again|did not confirm|left/i).first()).toBeVisible();
      }
    }
  });

  test("collection handles render native catalog pages", async ({ page }) => {
    await page.goto("/collections", { waitUntil: "domcontentloaded" });
    const collectionLink = page.locator("a[href^='/collections/']").first();
    if (!(await collectionLink.isVisible().catch(() => false))) {
      test.skip(true, "No seeded collection available");
      return;
    }
    const href = await collectionLink.getAttribute("href");
    expect(href).toMatch(/^\/collections\/.+/);
    await page.goto(href!, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/collections\/[^/?#]+(?:\?.*)?$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main ul").or(page.getByText(/no products are currently available/i))).toBeVisible();
  });

  test("image zoom opens a labelled dialog and restores focus", async ({ page }) => {
    const slug = await gotoFirstCatalogPdp(page);
    if (!slug) test.skip(true, "No seeded catalog product available");

    const trigger = page.getByRole("button", { name: /View larger:/ }).first();
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Enlarged product image" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
