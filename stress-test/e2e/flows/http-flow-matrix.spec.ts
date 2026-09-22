/**
 * Cross-service HTTP contract matrix: happy paths and representative error paths.
 *
 * Run (default: does not start webServers; use an existing `pnpm dev` or point bases at live URLs):
 *   pnpm test:http-flow
 * Boot stack via Playwright (same as full E2E):
 *   pnpm test:http-flow:with-webservers
 *   or PLAYWRIGHT_SKIP_WEBSERVER=0 pnpm test:http-flow
 *
 * Env:
 *   PLAYWRIGHT_SKIP_HTTP_MATRIX=1  — skip entire file
 *   PLAYWRIGHT_BASE_URL            — storefront (default http://localhost:3000)
 *   PLAYWRIGHT_WORKER_URL          — Worker origin (default http://127.0.0.1:8787)
 */

import { test, expect } from "@playwright/test";
import { apiBaseUrl, skipUnlessApiHealthy } from "../helpers/api";
import {
  storefrontHttpBase,
  skipUnlessStorefrontReachable,
} from "../helpers/http-flow";

test.beforeEach(() => {
  test.skip(
    process.env.PLAYWRIGHT_SKIP_HTTP_MATRIX === "1",
    "PLAYWRIGHT_SKIP_HTTP_MATRIX=1",
  );
});

// ---------------------------------------------------------------------------
// Cloudflare Worker backend
// ---------------------------------------------------------------------------

test.describe("Cloudflare Worker HTTP matrix", () => {
  test("GET /healthz identifies the Worker runtime", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const base = apiBaseUrl();
    const res = await request.get(`${base}/healthz`);
    expect(res.ok(), `status ${res.status()}`).toBeTruthy();
    expect(await res.json()).toMatchObject({ status: "ok", runtime: "cloudflare_worker" });
  });

  test("GET /readyz returns a structured readiness result", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const base = apiBaseUrl();
    const res = await request.get(`${base}/readyz`, { failOnStatusCode: false });
    expect([200, 503]).toContain(res.status());
    const body = (await res.json()) as { status?: string; runtime?: string; databaseRoles?: unknown };
    expect(body.runtime).toBe("cloudflare_worker");
    expect(["ok", "not_ready"]).toContain(body.status);
    expect(body).toHaveProperty("databaseRoles");
  });

  test("GET /store/regions returns the Worker contract", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const res = await request.get(`${apiBaseUrl()}/store/regions`, { failOnStatusCode: false });
    expect([200, 503]).toContain(res.status());
    if (res.ok()) {
      const body = (await res.json()) as { regions?: unknown[]; data?: unknown[] };
      expect(Array.isArray(body.regions ?? body.data)).toBe(true);
    }
  });

  test("GET /compliance/export rejects missing internal credentials", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const res = await request.get(`${apiBaseUrl()}/compliance/export?email=test@example.invalid`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Removed standalone Medusa HTTP service: commerce contracts live on the Worker.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Storefront Next route handlers (serial to reduce shared IP rate limits)
// ---------------------------------------------------------------------------

test.describe.serial("Storefront HTTP matrix", () => {
  const base = () => storefrontHttpBase();

  test("GET /api/health", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/health`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { service?: string; status?: string };
    expect(body.service).toBe("storefront");
    expect(body.status).toBe("ok");
  });

  test("GET /api/health/sop", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/health/sop`);
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { commerceSource?: string };
    expect(json.commerceSource).toBe("cloudflare_worker");
  });

  test("GET /api/shop/product without slug returns 400", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/shop/product`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(await res.json()).toEqual({ error: "Invalid or missing slug" });
  });

  test("GET /api/shop/product with slug returns 200 or 404 or 503", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(
      `${base()}/api/shop/product?slug=__matrix_nonexistent_slug__`,
      { failOnStatusCode: false },
    );
    expect([200, 404, 503]).toContain(res.status());
    if (res.status() === 404 || res.status() === 503) {
      expect(res.headers()["cache-control"]).toContain("no-store");
      expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    }
  });

  test("GET /api/shop/search-suggest short query returns empty suggestions", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/shop/search-suggest?q=a`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["cache-control"]).toContain("public");
    expect(res.headers()["pragma"]).toBeUndefined();
    const body = (await res.json()) as { suggestions?: unknown };
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  test("GET /api/reviews without filters returns 400", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/reviews`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Provide productSlug and/or medusaProductId" });
  });

  test("POST /api/reviews without session returns 401", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/reviews`, {
      data: {},
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/cart/resume returns JSON lines envelope", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/cart/resume`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { lines?: unknown };
    expect(Array.isArray(body.lines)).toBe(true);
  });

  test("POST /api/cart/bind invalid JSON returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/cart/bind`, {
      headers: { "Content-Type": "application/json" },
      data: "not-json",
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/cart/bind missing cartId returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/cart/bind`, {
      data: {},
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/cart/bind rejects unowned cart id", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/cart/bind`, {
      data: { cartId: "cart_00000000000000000000000000000000" },
      failOnStatusCode: false,
    });
    // Ownership is checked before the Worker lookup so callers cannot use this
    // endpoint to probe whether another cart exists.
    expect(res.status()).toBe(403);
  });

  test("POST /api/cart/abandonment invalid JSON returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/cart/abandonment`, {
      headers: { "Content-Type": "application/json" },
      data: "{",
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/cart/abandonment minimal payload returns JSON", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/cart/abandonment`, {
      data: { email: null, lines: [] },
      failOnStatusCode: false,
    });
    expect([200, 500]).toContain(res.status());
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("ok");
  });

  test("POST /api/tracking-link invalid JSON returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/tracking-link`, {
      headers: { "Content-Type": "application/json" },
      data: "not-json",
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/tracking-link missing cartId returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/tracking-link`, {
      data: {},
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("GET /api/cms/preview missing params returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/cms/preview`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/forms/unknown returns 400", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/forms/not-a-real-form`, {
      data: { foo: "bar" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/forms/contact invalid JSON returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/forms/contact`, {
      headers: { "Content-Type": "application/json" },
      data: "not-json",
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });
});
