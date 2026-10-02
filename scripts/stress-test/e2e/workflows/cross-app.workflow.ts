import "../runtime-logs-init";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { adminBase } from "../fixtures/env";
import { e2eAdminLogin } from "../helpers/admin-e2e-auth";

/**
 * Cross-app: storefront health + admin orders route behavior (auth or redirect).
 * Full order reflection requires completing checkout with seeded data; this verifies surfaces.
 */
export async function assertCrossAppHttpProbes(request: APIRequestContext): Promise<void> {
  const sf = await request.get("/api/health");
  expect(sf.ok()).toBeTruthy();

  const orders = await request.get(`${adminBase.replace(/\/$/, "")}/admin/orders`, {
    maxRedirects: 0,
  });
  expect([200, 302, 307, 308]).toContain(orders.status());
}

/**
 * When staff E2E auth works, open orders list and assert shell (chained admin state).
 */
export async function assertAdminOrdersShellWhenAuthenticated(page: Page): Promise<
  "ok" | "skip_no_ui" | "skip_no_env"
> {
  const login = await e2eAdminLogin(page);
  if (login !== "ok") return login;

  await page.goto(`${adminBase}/admin/orders`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(page).not.toHaveURL(/\/sign-in(\/|$|\?)|\/api\/auth\/signin/i, {
    timeout: 15_000,
  });
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/Application error|Unhandled Runtime Error/i);
  return "ok";
}
