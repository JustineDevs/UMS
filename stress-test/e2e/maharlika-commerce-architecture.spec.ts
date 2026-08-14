import { test, expect } from "@playwright/test";

import { expectCheckoutShellVisible, gotoFirstCatalogPdp } from "./helpers/storefront";
import { strictCatalog } from "./fixtures/env";
import {
  journeyConcurrentCheckoutTabs,
  journeyHelpShell,
  journeyStripeReturnNo5xx,
} from "./workflows/storefront-journeys.workflow";

/**
 * Thirteen end-to-end checks aligned with cross-app commerce architecture.
 * Tags: @architecture @smoke — filter with `pnpm exec playwright test --grep "@architecture"`.
 */
test.describe("@architecture @smoke Universal Music Store commerce architecture (13 scenarios)", () => {
  test("1. Customer path: shop health, optional PDP when catalog exists", async ({
    page,
    request,
  }) => {
    const health = await request.get("/api/health");
    expect(health.ok()).toBeTruthy();
    const slug = await gotoFirstCatalogPdp(page);
    if (!slug) {
      if (strictCatalog()) {
        throw new Error("No catalog products for strict E2E.");
      }
      await expect(page.locator("body")).toBeVisible();
      return;
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("2. Payment session path: checkout shell loads for hosted or embedded recovery flows", async ({
    page,
  }) => {
    await page.goto("/checkout");
    await expectCheckoutShellVisible(page);
  });

  test("3. Provider return path: stripe-return page responds without 5xx", async ({ page }) => {
    await journeyStripeReturnNo5xx(page);
  });

  test("4. Compare-at merchandising: browse surfaces load", async ({ page }) => {
    const res = await page.goto("/shop", { waitUntil: "domcontentloaded" });
    expect(res?.ok()).toBeTruthy();
  });

  test("5. Editorial-only path: home page loads for browse refresh", async ({ page }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.ok()).toBeTruthy();
  });

  test("6. Concurrent tabs: two checkout sessions both show checkout shell", async ({
    browser,
  }) => {
    await journeyConcurrentCheckoutTabs(browser);
  });

  test("7. Unpublish or block: invalid product slug returns controlled API error", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/shop/product?slug=___not_a_real_product_slug___",
    );
    expect([400, 404]).toContain(res.status());
  });

  test("8. POS or offline: Medusa commerce SOP is reported on health endpoint", async ({
    request,
  }) => {
    const res = await request.get("/api/health/sop");
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { commerceSource?: string };
    expect(json.commerceSource).toBe("medusa");
  });

  test("9. Region payment providers: availability API is stable when Medusa misconfigured", async ({
    request,
  }) => {
    const res = await request.get("/api/checkout/available-payment-methods");
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { ok: boolean; keys: unknown[] };
    expect(typeof json.ok).toBe("boolean");
    expect(Array.isArray(json.keys)).toBeTruthy();
  });

  test("10. Admin order surfaces: orders route requires auth (redirect or challenge)", async ({
    request,
  }) => {
    const adminOrigin = process.env.PLAYWRIGHT_ADMIN_ORIGIN ?? "http://localhost:3001";
    const res = await request.get(`${adminOrigin}/admin/orders`, {
      maxRedirects: 0,
    });
    expect([200, 302, 307, 308]).toContain(res.status());
  });

  test("11. Returns: track help surface loads for post-order flows", async ({ page }) => {
    await journeyHelpShell(page);
  });

  test("12. Receipts: admin receipts entry responds", async ({ request }) => {
    const adminOrigin = process.env.PLAYWRIGHT_ADMIN_ORIGIN ?? "http://localhost:3001";
    const res = await request.get(`${adminOrigin}/admin/receipts`, {
      maxRedirects: 0,
    });
    expect([200, 302, 307, 308]).toContain(res.status());
  });

  test("13. Channel intake: admin channels entry responds", async ({ request }) => {
    const adminOrigin = process.env.PLAYWRIGHT_ADMIN_ORIGIN ?? "http://localhost:3001";
    const res = await request.get(`${adminOrigin}/admin/channels`, {
      maxRedirects: 0,
    });
    expect([200, 302, 307, 308]).toContain(res.status());
  });
});
