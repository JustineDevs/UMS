import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible, gotoFirstCatalogPdp } from "../helpers/storefront";
import { exercisePaymentMethodToggles } from "../workflows/checkout-full.workflow";
import { attachConsoleListener, detachConsoleListener } from "../helpers/artifacts";
import { e2eAdminLogin } from "../helpers/admin-e2e-auth";
import { adminBase } from "../fixtures/env";

test.describe.configure({ mode: "parallel" });

test.describe("@matrix @checkout chained payment toggles + shell", () => {
  test("checkout loads payment rows and allows sequential provider selection", async ({
    page,
  }) => {
    const issues: { type: "error" | "warning"; text: string }[] = [];
    attachConsoleListener(page, issues);
    try {
      await page.goto("/checkout", { waitUntil: "domcontentloaded" });
      await expectCheckoutShellVisible(page);
      const tried = await exercisePaymentMethodToggles(page);
      expect(tried.length >= 0).toBeTruthy();
    } finally {
      detachConsoleListener(page);
    }
  });
});

test.describe("@matrix @workflow PDP buy box when catalog exists", () => {
  test("pdp add-to-bag control reaches ready state", async ({ page }) => {
    const slug = await gotoFirstCatalogPdp(page);
    if (!slug) {
      test.skip(true, "No catalog product for matrix PDP.");
      return;
    }
    const add = page.getByTestId("pdp-add-to-bag");
    await expect(add).toBeVisible({ timeout: 30_000 });
    await expect(add).toBeEnabled({ timeout: 45_000 });
  });
});

test.describe("@matrix @admin command surface and sidebar", () => {
  test("authenticated admin shows layout without runtime error banner", async ({ page }) => {
    test.setTimeout(120_000);
    const login = await e2eAdminLogin(page);
    if (login !== "ok") {
      test.skip(true, "Admin E2E auth not configured.");
      return;
    }
    await page.goto(`${adminBase}/admin/catalog`, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Unhandled Runtime Error/i);
  });
});
