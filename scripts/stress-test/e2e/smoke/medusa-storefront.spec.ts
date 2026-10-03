import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible } from "../helpers/storefront";

test.describe("Medusa-oriented storefront probes", () => {
  test("health/sop reports Worker commerce source", async ({ request }) => {
    const res = await request.get("/api/health/sop");
    expect([200, 503]).toContain(res.status());
    const json = (await res.json()) as { commerceSource?: string };
    expect(json.commerceSource).toBe("cloudflare_worker");
  });

  test("checkout page still loads for Medusa-only flow", async ({ page }) => {
    await page.goto("/checkout");
    await expectCheckoutShellVisible(page);
  });
});
