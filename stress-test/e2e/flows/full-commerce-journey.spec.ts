import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible, gotoFirstCatalogPdp } from "../helpers/storefront";
import { journeySignInHeading } from "../workflows/storefront-journeys.workflow";

function shouldFailOnMissingPrereq(): boolean {
  return process.env.CI_STRICT_E2E === "1" || process.env.CI === "true";
}

/**
 * End-to-end commerce paths (guest): SOP, catalog, PDP, bag affordance, checkout shell.
 * Tags: @workflow @checkout — `pnpm exec playwright test --grep "@workflow"`
 */
test.describe("@workflow @checkout Full commerce journey (guest)", () => {
  test("commerce SOP reports Medusa", async ({ request }) => {
    const res = await request.get("/api/health/sop");
    expect(res.ok(), `/api/health/sop ${res.status()}`).toBeTruthy();
    const json = (await res.json()) as { commerceSource?: string };
    expect(json.commerceSource).toBe("medusa");
  });

  test("shop to first PDP and add-to-bag when catalog exists", async ({ page }) => {
    const slug = await gotoFirstCatalogPdp(page);
    if (!slug) {
      if (shouldFailOnMissingPrereq()) {
        throw new Error(
          "No catalog products available for the full-commerce journey. Run pnpm e2e:prep:medusa before CI validation.",
        );
      }
      test.skip(
        true,
        "No catalog products. Run: node stress-test/scripts/e2e-prep-medusa.mjs (Medusa must be stopped or DB lock OK).",
      );
    }
    const addBtn = page.locator('[data-testid="pdp-add-to-bag"]:visible').first();
    await expect(addBtn).toBeVisible({ timeout: 30_000 });
    await expect(addBtn).not.toContainText("Loading", { timeout: 45_000 });
    await expect(addBtn).toBeEnabled({ timeout: 45_000 });
  });

  test("checkout page loads (guest sign-in or pay shell)", async ({ page }) => {
    await page.goto("/checkout");
    await expectCheckoutShellVisible(page);
  });

  test("sign-in page loads for account flows", async ({ page }) => {
    await journeySignInHeading(page);
  });
});
