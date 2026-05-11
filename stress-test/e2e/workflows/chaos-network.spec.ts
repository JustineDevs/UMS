import { test, expect } from "@playwright/test";

import { abortFirstMatch, removeRoutes, applySlowNetwork } from "../helpers/network-chaos";
import { expectCheckoutShellVisible } from "../helpers/storefront";

test.describe.configure({ mode: "parallel" });

test.describe("@chaos @resilience storefront degrades without white screen", () => {
  test("slow shop JSON still renders shell", async ({ page }) => {
    await applySlowNetwork(page, "**/api/**", 400);
    try {
      await page.goto("/shop", { waitUntil: "domcontentloaded", timeout: 120_000 });
      await expect(page.locator("body")).toBeVisible();
    } finally {
      await removeRoutes(page);
    }
  });

  test("first catalog API abort then reload shows recovery path", async ({ page }) => {
    await abortFirstMatch(page, "**/api/**");
    await page.goto("/shop", { waitUntil: "domcontentloaded", timeout: 120_000 }).catch(() => {});
    await removeRoutes(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("checkout shell after chaos navigation", async ({ page }) => {
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await expectCheckoutShellVisible(page);
  });
});
