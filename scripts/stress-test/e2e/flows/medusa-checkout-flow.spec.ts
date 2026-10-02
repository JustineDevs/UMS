import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible } from "../helpers/storefront";

/** Deployed: https://universal-music-store-custom.vercel.app */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/**
 * Smoke: storefront health → browse shop → checkout affordance (Medusa-oriented).
 * Does not simulate PSP webhooks; use staging + manual QA for payment capture.
 */
test.describe("Medusa storefront checkout flow (smoke)", () => {
  test("GET /api/health returns storefront ok", async ({ request }) => {
    const res = await request.get(`${baseURL}/api/health`);
    expect(res.ok(), `/api/health ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ service: "storefront", status: "ok" });
    expect(body).toHaveProperty("timestamp");
  });

  test("shop loads and checkout shows entry affordance", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading").first()).toBeVisible();

    await page.goto("/checkout");
    await expectCheckoutShellVisible(page);
  });
});
