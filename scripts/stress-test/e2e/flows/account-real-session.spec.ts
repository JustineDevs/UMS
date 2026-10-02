import { expect, test } from "@playwright/test";

import { e2eAdminLogin, ensureE2eProfileComplete } from "../helpers/admin-e2e-auth";

type ObservedResponse = { path: string; status: number };

test.describe("Authenticated account browser flow", () => {
  test("loads the current account shell and verifies private state APIs", async ({ page }) => {
    test.skip(process.env.AUTH_DISABLED === "true", "Auth-disabled mode cannot prove a real authenticated account session.");
    const login = await e2eAdminLogin(page);
    test.skip(login !== "ok", "A real local authenticated session is required for account proof.");
    await ensureE2eProfileComplete(page);

    const observed: ObservedResponse[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === new URL(page.url()).origin && url.pathname.startsWith("/api/")) {
        observed.push({ path: url.pathname, status: response.status() });
      }
    });

    await page.goto("/account", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/account\/profile(?:$|[?#])/);
    await expect(page.getByRole("heading", { name: "Account settings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile information", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    const navigation = page.getByLabel("Account navigation");
    for (const name of ["Profile", "Payment Methods", "Addresses", "Notification Settings", "Order Settings"]) {
      const link = navigation.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect.poll(() => link.evaluate((node) => Math.round(node.getBoundingClientRect().height)), { timeout: 30_000 }).toBeGreaterThanOrEqual(44);
    }

    await navigation.getByRole("button", { name: "My Purchase", exact: true }).click();
    await navigation.getByRole("link", { name: "Purchase History", exact: true }).click();
    await expect(page).toHaveURL(/\/account\/orders(?:$|[?#])/);
    await expect(page.getByRole("heading", { name: "Purchase History", exact: true })).toBeVisible();

    const apiResults = await page.evaluate(async () => {
      const paths = [
        "/api/account/profile/status",
        "/api/account/marketing-preferences",
        "/api/account/order-preferences",
        "/api/account/privacy/export",
        "/api/wishlist",
      ];
      return Promise.all(paths.map(async (path) => {
        const response = await fetch(path, { cache: "no-store" });
        return {
          path,
          status: response.status,
          cacheControl: response.headers.get("cache-control"),
          contentDisposition: response.headers.get("content-disposition"),
          body: path.endsWith("/privacy/export") ? null : await response.json().catch(() => null),
        };
      }));
    });

    for (const result of apiResults) expect(result.status, `${result.path} status`).toBe(200);
    expect(apiResults.find((result) => result.path === "/api/account/profile/status")?.body).toMatchObject({ authenticated: true, complete: true });
    expect(apiResults.find((result) => result.path === "/api/wishlist")?.body).toHaveProperty("items");
    expect(apiResults.find((result) => result.path === "/api/account/privacy/export")).toMatchObject({ status: 200, contentDisposition: 'attachment; filename="my-account-data.json"' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/account/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Account settings", exact: true })).toBeVisible({ timeout: 30_000 });
    const mobileProfile = page.getByLabel("Account navigation").getByRole("link", { name: "Profile", exact: true });
    await mobileProfile.focus();
    await expect(mobileProfile).toBeFocused();
    const focusStyle = await mobileProfile.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
    });
    expect(focusStyle.outlineStyle !== "none" || focusStyle.outlineWidth !== "0px" || focusStyle.boxShadow !== "none").toBe(true);

    expect(observed.some((entry) => entry.path === "/api/account/profile/status" && entry.status === 200)).toBe(true);
    expect(observed.some((entry) => entry.path === "/api/account/marketing-preferences" && entry.status === 200)).toBe(true);
    expect(observed.some((entry) => entry.path === "/api/account/order-preferences" && entry.status === 200)).toBe(true);
  });
});
