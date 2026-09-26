import { expect, test } from "@playwright/test";

import { e2eAdminLogin } from "../helpers/admin-e2e-auth";

test.describe("Authenticated account logout and session invalidation", () => {
  test("sign out invalidates private requests and persists after reload", async ({ page }) => {
    const login = await e2eAdminLogin(page);
    test.skip(login !== "ok", "A real local authenticated session is required for logout proof.");

    await page.goto("/account", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({ timeout: 30_000 });

    const beforeLogout = await page.evaluate(async () => {
      const response = await fetch("/api/account/profile/status", { cache: "no-store" });
      return { status: response.status, body: await response.json().catch(() => null) };
    });
    expect(beforeLogout.status).toBe(200);
    expect(beforeLogout.body).toMatchObject({ authenticated: true });

    let e2eLogoutStatus: number | undefined;
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/api/auth/e2e" && response.request().method() === "DELETE") {
        e2eLogoutStatus = response.status();
      }
    });
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    expect(e2eLogoutStatus).toBe(200);

    const afterLogout = await page.evaluate(async () => {
      const [statusResponse, privateResponse] = await Promise.all([
        fetch("/api/account/profile/status", { cache: "no-store" }),
        fetch("/api/account/privacy/export", { cache: "no-store" }),
      ]);
      return {
        status: statusResponse.status,
        body: await statusResponse.json().catch(() => null),
        privateStatus: privateResponse.status,
      };
    });
    expect(afterLogout.status).toBe(200);
    expect(afterLogout.body).toMatchObject({ authenticated: false });
    expect(afterLogout.privateStatus).toBe(401);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible({ timeout: 30_000 });

    await page.goto("/account", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Sign in to view your order history.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Sign in to your account", exact: true })).toBeVisible();
  });
});
