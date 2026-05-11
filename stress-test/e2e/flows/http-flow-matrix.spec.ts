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
 *   PLAYWRIGHT_API_URL             — Express API (default http://localhost:4000)
 *   PLAYWRIGHT_MEDUSA_URL          — Medusa health URL or origin (default probes localhost:9000)
 *   INTERNAL_API_KEY               — enables authenticated compliance scenarios
 *   NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY — enables Medusa store smoke when set
 */

import { test, expect } from "@playwright/test";
import { apiBaseUrl, skipUnlessApiHealthy } from "../helpers/api";
import {
  storefrontHttpBase,
  medusaHttpBase,
  internalApiKey,
  medusaPublishableKey,
  skipUnlessStorefrontReachable,
  skipUnlessMedusaReachable,
} from "../helpers/http-flow";

test.beforeEach(() => {
  test.skip(
    process.env.PLAYWRIGHT_SKIP_HTTP_MATRIX === "1",
    "PLAYWRIGHT_SKIP_HTTP_MATRIX=1",
  );
});

// ---------------------------------------------------------------------------
// Express internal API
// ---------------------------------------------------------------------------

test.describe("Express API HTTP matrix", () => {
  test("GET /health returns JSON status envelope", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const base = apiBaseUrl();
    const res = await request.get(`${base}/health`);
    expect(res.ok(), `status ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("medusa");
    expect(body).toHaveProperty("supabase");
  });

  test("GET /health/commerce includes commerceEngine", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const base = apiBaseUrl();
    const res = await request.get(`${base}/health/commerce`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.commerceEngine).toBe("medusa");
    expect(typeof body.timestamp).toBe("string");
  });

  test("GET /health/ready returns structured readiness", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const base = apiBaseUrl();
    const res = await request.get(`${base}/health/ready`, {
      failOnStatusCode: false,
    });
    expect([200, 503]).toContain(res.status());
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.ready).toBe("boolean");
    expect(body).toHaveProperty("medusa");
    expect(body).toHaveProperty("supabase");
  });

  test("GET /compliance/export without credentials matches dev/prod policy", async ({
    request,
  }) => {
    await skipUnlessApiHealthy(request);
    const base = apiBaseUrl();
    const res = await request.get(
      `${base}/compliance/export?email=test@example.com`,
      { failOnStatusCode: false },
    );
    const key = internalApiKey();
    if (key) {
      expect(res.status()).toBe(401);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("INVALID_INTERNAL_API_KEY");
    } else {
      expect(res.status()).not.toBe(401);
      expect([200, 404, 500]).toContain(res.status());
    }
  });

  test("GET /compliance/export without email returns 400 when auth bypassed", async ({
    request,
  }) => {
    await skipUnlessApiHealthy(request);
    if (internalApiKey()) {
      test.skip(true, "INTERNAL_API_KEY set; use authenticated compliance tests instead");
    }
    const base = apiBaseUrl();
    const res = await request.get(`${base}/compliance/export`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("MISSING_EMAIL");
  });

  test("GET /compliance/export with key but no email returns 400", async ({
    request,
  }) => {
    await skipUnlessApiHealthy(request);
    const key = internalApiKey();
    if (!key) {
      test.skip(true, "Set INTERNAL_API_KEY");
    }
    const base = apiBaseUrl();
    const res = await request.get(`${base}/compliance/export`, {
      headers: { "x-internal-api-key": key! },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("MISSING_EMAIL");
  });

  test("GET /compliance/export with key and unknown email returns 404", async ({
    request,
  }) => {
    await skipUnlessApiHealthy(request);
    const key = internalApiKey();
    if (!key) {
      test.skip(true, "Set INTERNAL_API_KEY to run authenticated compliance read");
    }
    const base = apiBaseUrl();
    const email = `psp-matrix-${Date.now()}@example.invalid`;
    const res = await request.get(
      `${base}/compliance/export?email=${encodeURIComponent(email)}`,
      {
        headers: { "x-internal-api-key": key! },
        failOnStatusCode: false,
      },
    );
    expect(res.status()).toBe(404);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// Medusa
// ---------------------------------------------------------------------------

test.describe("Medusa HTTP matrix", () => {
  test("GET /health is OK", async ({ request }) => {
    await skipUnlessMedusaReachable(request);
    const base = medusaHttpBase();
    const res = await request.get(`${base}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test("GET /admin/payment-health returns provider map", async ({ request }) => {
    await skipUnlessMedusaReachable(request);
    const base = medusaHttpBase();
    const res = await request.get(`${base}/admin/payment-health`, {
      failOnStatusCode: false,
    });
    if (res.status() === 401 || res.status() === 403) {
      test.skip(true, "Admin payment-health requires Medusa admin auth in this environment");
    }
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      configuredCount?: number;
      providers?: Record<string, unknown>;
    };
    expect(body).toHaveProperty("providers");
    expect(typeof body.configuredCount).toBe("number");
  });

  test("GET /store/regions with publishable key returns list shape", async ({
    request,
  }) => {
    await skipUnlessMedusaReachable(request);
    const pk = medusaPublishableKey();
    if (!pk) {
      test.skip(true, "Set NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (or PLAYWRIGHT_MEDUSA_PUBLISHABLE_KEY)");
    }
    const base = medusaHttpBase();
    const res = await request.get(`${base}/store/regions`, {
      headers: { "x-publishable-api-key": pk! },
      failOnStatusCode: false,
    });
    expect(res.ok(), `store/regions failed: ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as {
      regions?: unknown[];
      data?: unknown[];
    };
    const list = body.regions ?? body.data;
    expect(Array.isArray(list)).toBe(true);
  });
});

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
    expect(json.commerceSource).toBe("medusa");
  });

  test("GET /api/shop/product without slug returns 400", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/shop/product`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
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
  });

  test("GET /api/shop/search-suggest short query returns empty suggestions", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/shop/search-suggest?q=a`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { suggestions?: unknown };
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  test("GET /api/reviews without filters returns 400", async ({ request }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.get(`${base()}/api/reviews`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
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

  test("POST /api/cart/medusa-bind invalid JSON returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/cart/medusa-bind`, {
      headers: { "Content-Type": "application/json" },
      data: "not-json",
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/cart/medusa-bind missing cartId returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/cart/medusa-bind`, {
      data: {},
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/cart/medusa-bind bogus cart id returns 400", async ({
    request,
  }) => {
    await skipUnlessStorefrontReachable(request);
    const res = await request.post(`${base()}/api/cart/medusa-bind`, {
      data: { cartId: "cart_00000000000000000000000000000000" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
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
