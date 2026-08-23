import { test, expect } from "@playwright/test";

import { gotoFirstCatalogPdp } from "../helpers/storefront";
import { setViewport } from "../helpers/viewports";

test.describe("storefront UX and compliance", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(45_000);
  });

  test("mobile navigation is a keyboard-operable dialog", async ({ page }) => {
    await setViewport(page, "mobile");
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const trigger = page.getByTestId("mobile-menu-trigger");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveAttribute("data-hydrated", "true");
    await trigger.focus();
    await trigger.press("Enter");

    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible({ timeout: 15_000 });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("mobile shop filters use a focus-managed dialog", async ({ page }) => {
    await setViewport(page, "mobile");
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const trigger = page.getByRole("button", { name: "Filters" });
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await expect(trigger).toHaveAttribute("data-hydrated", "true");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Shop filters" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
    const firstGroup = dialog.locator("details").first();
    await expect(firstGroup).toHaveAttribute("open", "");
    await firstGroup.locator("summary").click();
    await expect(firstGroup).not.toHaveAttribute("open", "");
    const undersizedTargets = await dialog
      .locator("details a:visible")
      .evaluateAll((links) =>
        links
          .map((link) => Math.round(link.getBoundingClientRect().height))
          .filter((height) => height < 44),
      );
    expect(undersizedTargets).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("public policy pages expose version and effective date", async ({
    page,
  }) => {
    for (const path of ["/privacy", "/terms", "/cookies", "/accessibility"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-policy-version]")).toHaveAttribute(
        "data-policy-effective-date",
        /^20\d\d-\d\d-\d\d$/,
      );
      await expect(page.getByText(/Version 2026\.08/)).toBeVisible();
    }
  });

  test("preferences truthfully persist locally without changing commerce context", async ({
    page,
  }) => {
    await page.goto("/preferences", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Local storefront preferences" }),
    ).toBeVisible();
    await expect(page.getByText(/saved on this device only/i)).toBeVisible();
    await page.locator("#pref-lang").selectOption("fil");
    await expect(page.getByRole("status")).toHaveText(/saved to this device/i);
    const stored = await page.evaluate(() =>
      localStorage.getItem("universal_music_store_storefront_prefs_v2"),
    );
    expect(stored).toContain('"language":"fil"');
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#pref-lang")).toHaveValue("fil");
    await expect(
      page.getByText(/does not change the checkout currency/i),
    ).toBeVisible();
  });

  test("search combobox supports active descendant and keyboard selection", async ({
    page,
  }) => {
    await page.route("**/api/shop/search-suggest**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          suggestions: [{ slug: "canary", name: "Canary", minPrice: 1999 }],
        }),
      }),
    );
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const input = page.locator("#catalog-typeahead");
    await input.fill("ca");
    const option = page.getByRole("option", { name: /Canary/ });
    await expect(option).toBeVisible({ timeout: 15_000 });
    await input.press("ArrowDown");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      "catalog-suggestion-0",
    );
    await input.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("search combobox distinguishes catalog outage from no results", async ({
    page,
  }) => {
    await page.route("**/api/shop/search-suggest**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ suggestions: [], error: "catalog_unavailable" }),
      }),
    );
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const input = page.locator("#catalog-typeahead");
    await input.fill("ca");
    await expect(
      page.locator('[role="status"]').filter({
        hasText: /search suggestions are temporarily unavailable/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("search combobox explains an empty successful response", async ({
    page,
  }) => {
    await page.route("**/api/shop/search-suggest**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ suggestions: [] }),
      }),
    );
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const input = page.locator("#catalog-typeahead");
    await input.fill("zz");
    await expect(
      page.locator('[role="status"]').filter({
        hasText: /no matching products yet/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("shop no-result search offers a query-cleared recovery link", async ({
    page,
  }) => {
    await page.goto(
      "/shop?q=definitely-not-a-real-universal-music-product-9f3c",
      {
        waitUntil: "domcontentloaded",
      },
    );
    await expect(page.getByText(/no products found for/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("link", { name: "Clear search" }),
    ).toHaveAttribute("href", "/shop?sort=newest");
  });

  test("shop canonicalizes invalid and unknown query state", async ({
    page,
  }) => {
    await page.goto("/shop?minPrice=not-a-number&unknown=1", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/shop$/, { timeout: 30_000 });
  });

  test("shop result range is announced as a live status", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const status = page
      .getByRole("status")
      .filter({ hasText: /Showing \d+–\d+ of \d+/ });
    if (!(await status.isVisible().catch(() => false))) {
      test.skip(true, "No seeded catalog products available");
      return;
    }
    await expect(status).toHaveAttribute("aria-live", "polite");
  });

  test("shop marks the active category filter for assistive technology", async ({
    page,
  }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const categoryLink = page.locator("aside a[href*='category=']").first();
    if (!(await categoryLink.isVisible().catch(() => false))) {
      test.skip(true, "No seeded matching category available");
      return;
    }
    const categoryLabel =
      (await categoryLink.locator("span").first().textContent())?.trim() ?? "";
    await categoryLink.click();
    const active = page.locator('aside a[aria-current="page"]').first();
    await expect(active).toContainText(categoryLabel);
  });

  test("shop metadata noindexes filtered and paginated URLs", async ({
    page,
  }) => {
    await page.goto("/shop?type=electric&offset=20", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/i,
    );
    await page.goto("/shop?category=guitars", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /index/i,
    );
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
      "content",
      /noindex/i,
    );
  });

  test("shop canonicalizes malformed filters without dropping valid filters", async ({
    page,
  }) => {
    await page.goto("/shop?category=guitars&type=electric&offset=invalid", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/shop\?category=guitars&type=electric$/, {
      timeout: 15_000,
    });
  });

  test("auth-disabled local mode does not load reCAPTCHA", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page.locator('script[src*="recaptcha"]')).toHaveCount(0);
  });

  test("generated sitemap exposes public routes", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBeTruthy();
    const xml = await response.text();
    for (const path of [
      "/shop",
      "/collections",
      "/privacy",
      "/terms",
      "/accessibility",
    ]) {
      expect(xml).toContain(path);
    }
  });

  test("about page is usable on mobile and desktop", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/about", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Browse the shop" }),
      ).toHaveAttribute("href", "/shop");
      await expect(
        page.getByRole("link", { name: "Contact support" }),
      ).toHaveAttribute("href", "/contact");
      const jsonLd = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      expect(jsonLd.some((raw) => raw.includes('"Organization"'))).toBeTruthy();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBeTruthy();
    }
  });

  test("collections expose a catalog snapshot status when catalog data is available", async ({
    page,
  }) => {
    await page.goto("/collections", { waitUntil: "domcontentloaded" });
    const freshness = page.locator("[data-catalog-freshness]");
    if (await freshness.count()) {
      await expect(freshness).toContainText(/Catalog snapshot updated/);
    }
  });

  test("tracking rejects incomplete capabilities and disables caching", async ({
    page,
    request,
  }) => {
    const response = await request.get("/track/order_not-a-capability");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toMatch(/no-store/i);
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    await page.goto("/track/order_not-a-capability", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Tracking link incomplete" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "customer support" }),
    ).toHaveAttribute("href", "/contact?topic=tracking");
  });

  test("hosted provider cancel and failure returns never expose an order", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "ums-commerce-cart-v4",
        JSON.stringify([
          {
            variantId: "hosted-recovery-fixture",
            quantity: 1,
            name: "Hosted recovery fixture",
            slug: "hosted-recovery-fixture",
            sku: "HOSTED-RECOVERY",
            type: "Default",
            finish: "",
            price: 100,
          },
        ]),
      );
    });
    for (const provider of ["stripe", "paypal", "xendit"]) {
      for (const status of ["cancel", "failed", "expired"]) {
        await page.goto(
          `/checkout/hosted-return?provider=${provider}&status=${status}`,
          {
            waitUntil: "domcontentloaded",
          },
        );
        await expect(page).not.toHaveURL(/\/track\/order_/i);
        await expect(
          page
            .getByText(/return to checkout|try again|did not confirm|left/i)
            .first(),
        ).toBeVisible({ timeout: 15_000 });
        await expect
          .poll(async () =>
            page.evaluate(() => localStorage.getItem("ums-commerce-cart-v4")),
          )
          .toContain("hosted-recovery-fixture");
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
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible();
    await expect(
      page.getByText(/^Showing \d+ (?:product|products)$/),
    ).toBeVisible();
    await expect(page.getByText("Sorted by newest")).toBeVisible();
    const structuredData = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(
      structuredData.some(
        (raw) => raw.includes('"BreadcrumbList"') && raw.includes('"ItemList"'),
      ),
    ).toBeTruthy();
    await expect(
      page
        .locator("main ul")
        .or(page.getByText(/no products are currently available/i)),
    ).toBeVisible();
  });

  test("image zoom opens a labelled dialog and restores focus", async ({
    page,
  }) => {
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
