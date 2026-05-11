import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible } from "../helpers/storefront";
import { setViewport } from "../helpers/viewports";
import { adminBase } from "../fixtures/env";

test.describe.configure({ mode: "parallel" });

test.describe("@layout @matrix storefront shell permutations", () => {
  for (const vp of ["mobile", "tablet", "desktop", "ultraWide"] as const) {
    test(`home and checkout remain usable at ${vp}`, async ({ page }) => {
      await setViewport(page, vp);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      await page.goto("/checkout", { waitUntil: "domcontentloaded" });
      await expectCheckoutShellVisible(page);
    });
  }

  test("rapid route switching does not leave blank body", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await expectCheckoutShellVisible(page);
  });

  test("browser back from checkout to shop preserves chrome", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await page.goBack();
    await expect(page).toHaveURL(/\/shop/);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("@layout @admin @matrix admin root responds", () => {
  test("admin base URL returns without network failure", async ({ request }) => {
    const res = await request.get(adminBase, { maxRedirects: 0, failOnStatusCode: false });
    expect([200, 301, 302, 307, 308, 404]).toContain(res.status());
  });
});
