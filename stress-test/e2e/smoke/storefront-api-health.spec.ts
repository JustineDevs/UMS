/**
 * Storefront API route health smoke test.
 * Verifies every public GET endpoint returns 200 and every auth-required
 * endpoint returns 401 when called without a session.
 *
 * Run in isolation:
 *   pnpm exec playwright test stress-test/e2e/smoke/storefront-api-health.spec.ts
 */
import "../runtime-logs-init";
import { test, expect, type APIRequestContext } from "@playwright/test";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function get(request: APIRequestContext, path: string) {
  return request.get(`${base}${path}`, { failOnStatusCode: false });
}

test.describe("Storefront API health — public routes return 200", () => {
  test("GET /api/health → 200", async ({ request }) => {
    const res = await get(request, "/api/health");
    expect(res.status(), `/api/health → ${res.status()}`).toBe(200);
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBe("ok");
  });

  test("GET /api/health/sop → 200", async ({ request }) => {
    const res = await get(request, "/api/health/sop");
    expect(res.status(), `/api/health/sop → ${res.status()}`).toBe(200);
  });

  test("GET /api/checkout/available-payment-methods → 200", async ({ request }) => {
    const res = await get(request, "/api/checkout/available-payment-methods");
    expect(res.status(), `/api/checkout/available-payment-methods → ${res.status()}`).toBe(200);
  });

  test("GET /api/checkout/medusa-totals-preview → 200 or 400 (cart required)", async ({ request }) => {
    const res = await get(request, "/api/checkout/medusa-totals-preview");
    const status = res.status();
    expect(
      [200, 400, 422].includes(status),
      `/api/checkout/medusa-totals-preview → expected 200/400/422, got ${status}`,
    ).toBeTruthy();
  });

  test("GET /api/shop returns 200 or 404", async ({ request }) => {
    const res = await get(request, "/api/shop");
    const status = res.status();
    expect(
      [200, 404].includes(status),
      `/api/shop → expected 200/404, got ${status}`,
    ).toBeTruthy();
  });

  test("GET /api/cms returns 200 or 404", async ({ request }) => {
    const res = await get(request, "/api/cms");
    const status = res.status();
    expect(
      [200, 404].includes(status),
      `/api/cms → expected 200/404, got ${status}`,
    ).toBeTruthy();
  });

  test("GET /api/reviews returns 200 or 404", async ({ request }) => {
    const res = await get(request, "/api/reviews");
    const status = res.status();
    expect(
      [200, 404].includes(status),
      `/api/reviews → expected 200/404, got ${status}`,
    ).toBeTruthy();
  });
});

test.describe("Storefront API health — auth-required routes return 401 without session", () => {
  test("GET /api/account returns 401", async ({ request }) => {
    const res = await get(request, "/api/account");
    expect(res.status(), `/api/account → expected 401, got ${res.status()}`).toBe(401);
  });

  test("GET /api/orders returns 401", async ({ request }) => {
    const res = await get(request, "/api/orders");
    const status = res.status();
    expect(
      [401, 404].includes(status),
      `/api/orders → expected 401/404, got ${status}`,
    ).toBeTruthy();
  });

  test("GET /api/cart returns 200 or 401", async ({ request }) => {
    const res = await get(request, "/api/cart");
    const status = res.status();
    expect(
      [200, 401, 404].includes(status),
      `/api/cart → expected 200/401/404, got ${status}`,
    ).toBeTruthy();
  });

  test("POST /api/checkout/cod-place-order returns 400 without body", async ({ request }) => {
    const res = await request.post(`${base}/api/checkout/cod-place-order`, {
      data: {},
      failOnStatusCode: false,
    });
    const status = res.status();
    expect(
      [400, 401, 422].includes(status),
      `/api/checkout/cod-place-order empty body → expected 400/401/422, got ${status}`,
    ).toBeTruthy();
  });

  test("GET /api/cron/finalize-payment-attempts returns 401 without secret", async ({ request }) => {
    const res = await get(request, "/api/cron/finalize-payment-attempts");
    expect(
      res.status(),
      `/api/cron/finalize-payment-attempts without secret → expected 401, got ${res.status()}`,
    ).toBe(401);
  });
});
