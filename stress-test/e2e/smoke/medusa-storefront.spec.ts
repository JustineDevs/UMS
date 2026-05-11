import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible } from "../helpers/storefront";

test.describe("Medusa-oriented storefront probes", () => {
  test("health/sop reports medusa commerce source", async ({ request }) => {
    const res = await request.get("/api/health/sop");
    expect(res.ok(), "health/sop should return 200 with JSON body").toBeTruthy();
    const json = (await res.json()) as { commerceSource?: string };
    expect(json.commerceSource).toBe("medusa");
  });

  test("checkout page still loads for Medusa-only flow", async ({ page }) => {
    await page.goto("/checkout");
    await expectCheckoutShellVisible(page);
  });
});
