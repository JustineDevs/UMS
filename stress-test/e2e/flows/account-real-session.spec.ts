import { expect, test } from "@playwright/test";

import { e2eAdminLogin } from "../helpers/admin-e2e-auth";

type ObservedResponse = { path: string; status: number };

test.describe("Authenticated account browser flow", () => {
  test("loads account sections and verifies private state APIs", async ({ page }) => {
    const login = await e2eAdminLogin(page);
    test.skip(login !== "ok", "A real local authenticated session is required for account proof.");

    const observed: ObservedResponse[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === new URL(page.url()).origin && url.pathname.startsWith("/api/")) {
        observed.push({ path: url.pathname, status: response.status() });
      }
    });

    await page.goto("/account", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/account(?:$|[?#])/);
    await expect(page.getByRole("heading", { name: /welcome back|your account, in one place/i })).toBeVisible();
    for (const id of ["overview", "orders", "profile", "notifications", "preferences", "loyalty"]) {
      await expect(page.locator(`#${id}`).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    for (const name of ["Orders", "Profile & addresses", "Notifications", "Preferences", "Loyalty wallet"]) {
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect.poll(
        () => link.evaluate((node) => Math.round(node.getBoundingClientRect().height)),
        { timeout: 30_000 },
      ).toBeGreaterThanOrEqual(44);
    }

    const apiResults = await page.evaluate(async () => {
      const paths = [
        "/api/account/profile/status",
        "/api/account/marketing-preferences",
        "/api/account/order-preferences",
        "/api/account/loyalty",
        "/api/account/privacy/export",
        "/api/wishlist",
      ];
      const results = await Promise.all(paths.map(async (path) => {
        const response = await fetch(path, { cache: "no-store" });
        return {
          path,
          status: response.status,
          cacheControl: response.headers.get("cache-control"),
          contentDisposition: response.headers.get("content-disposition"),
          body: path.endsWith("/privacy/export") ? null : await response.json().catch(() => null),
        };
      }));
      return results;
    });

    for (const result of apiResults) {
      expect(result.status, `${result.path} status`).toBe(200);
    }
    expect(apiResults.find((result) => result.path === "/api/account/profile/status")?.body).toMatchObject({
      authenticated: true,
      complete: true,
    });
    expect(apiResults.find((result) => result.path === "/api/wishlist")?.body).toHaveProperty("items");
    const privacyExport = apiResults.find((result) => result.path === "/api/account/privacy/export");
    expect(privacyExport).toMatchObject({ status: 200, contentDisposition: 'attachment; filename="my-account-data.json"' });
    expect(privacyExport?.cacheControl).toContain("no-store");

    const search = page.locator("#account-order-search:visible").first();
    await search.fill("pending");
    await page.getByRole("button", { name: "Search orders" }).click();
    await expect(page).toHaveURL(/\/account\?q=pending$/);
    await expect(page.getByRole("heading", { name: /welcome back|your account, in one place/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#account-order-search:visible").first()).toHaveValue("pending", { timeout: 30_000 });

    await page.getByRole("link", { name: "Completed", exact: true }).click();
    await expect(page).toHaveURL(/\/account\?status=delivered&q=pending#orders$/);
    await expect(page.getByRole("link", { name: "Completed", exact: true })).toHaveAttribute("aria-current", "page");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/account\?status=delivered&q=pending#orders$/);
    // The account page rehydrates profile data after the document reload. Wait
    // for the real page shell before asserting persisted query state.
    await expect(page.getByRole("heading", { name: /welcome back|your account, in one place/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#account-order-search:visible").first()).toHaveValue("pending", { timeout: 30_000 });

    expect(observed.some((entry) => entry.path === "/api/account/profile/status" && entry.status === 200)).toBe(true);
    expect(observed.some((entry) => entry.path === "/api/account/marketing-preferences" && entry.status === 200)).toBe(true);
    expect(observed.some((entry) => entry.path === "/api/account/order-preferences" && entry.status === 200)).toBe(true);
    expect(observed.some((entry) => entry.path === "/api/account/loyalty" && entry.status === 200)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/account", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /welcome back|your account, in one place/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#overview").first()).toBeVisible();

    for (const name of ["Orders", "Profile & addresses", "Notifications", "Preferences", "Loyalty wallet"]) {
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect.poll(
        () => link.evaluate((node) => Math.round(node.getBoundingClientRect().height)),
        { timeout: 30_000 },
      ).toBeGreaterThanOrEqual(44);
    }

    const mobileOrdersLink = page.getByRole("link", { name: "Orders", exact: true });
    await mobileOrdersLink.focus();
    await expect(mobileOrdersLink).toBeFocused();
    const focusStyle = await mobileOrdersLink.evaluate((node) => {
      const style = window.getComputedStyle(node);
      const outlineWidth = Number.parseFloat(style.outlineWidth);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth,
        outlineWidthKeyword: style.outlineWidth,
      };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(
      focusStyle.outlineWidth >= 2 || focusStyle.outlineWidthKeyword === "medium",
    ).toBe(true);
  });
});
