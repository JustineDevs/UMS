import "../runtime-logs-init";
import { test, expect } from "@playwright/test";

/**
 * HTTP-level integration against the running Next storefront (Playwright webServer).
 * Exercises real `next/cache` revalidateTag/revalidatePath inside the route handler.
 */
/** playwright.config.ts sets a default after loading .env so this matches spawned webServer. */
const invalidationSecret =
  process.env.STOREFRONT_INTERNAL_INVALIDATION_SECRET?.trim() ||
  "playwright-e2e-invalidation-secret";

test.describe("Storefront commerce HTTP integration", () => {
  test("POST /api/internal/invalidate-commerce-state returns 401 when secret mismatches", async ({
    request,
  }) => {
    const res = await request.post("/api/internal/invalidate-commerce-state", {
      data: { classification: "editorial_only" },
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": "wrong-secret",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/internal/invalidate-commerce-state revalidates product and collection tags", async ({
    request,
  }) => {
    const res = await request.post("/api/internal/invalidate-commerce-state", {
      data: {
        classification: "editorial_only",
        productHandles: ["e2e-product-handle"],
        collectionHandles: ["e2e-collection-handle"],
      },
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": invalidationSecret,
      },
    });
    expect(res.status()).toBe(200);
    const json = (await res.json()) as {
      ok?: boolean;
      revalidatedTags?: string[];
      revalidatedPaths?: string[];
    };
    expect(json.ok).toBe(true);
    expect(json.revalidatedTags).toContain("product:e2e-product-handle");
    expect(json.revalidatedTags).toContain("collection:e2e-collection-handle");
    expect(json.revalidatedPaths).toContain("/shop/e2e-product-handle");
    expect(json.revalidatedPaths).toContain("/collections/e2e-collection-handle");
  });

  test("POST /api/checkout/medusa-totals-preview requires an authenticated session", async ({
    request,
  }) => {
    const res = await request.post("/api/checkout/medusa-totals-preview", {
      data: { lines: [{ variantId: "variant_e2e", quantity: 1 }], paymentMethod: "STRIPE" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
    const json = (await res.json()) as { error?: string };
    expect(typeof json.error).toBe("string");
  });

  test("GET /api/checkout/available-payment-methods returns Medusa region provider keys shape", async ({
    request,
  }) => {
    const res = await request.get("/api/checkout/available-payment-methods");
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { ok: boolean; keys: unknown[] };
    expect(typeof json.ok).toBe("boolean");
    expect(Array.isArray(json.keys)).toBeTruthy();
  });
});
