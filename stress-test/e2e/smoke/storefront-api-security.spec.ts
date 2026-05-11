import "../runtime-logs-init";
import { test, expect } from "@playwright/test";

const base =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Storefront commerce API hardening", () => {
  test("POST /api/cart/attach-customer returns 401 without session", async ({
    request,
  }) => {
    const res = await request.post(`${base}/api/cart/attach-customer`, {
      data: {},
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/cart/merge returns 401 without session", async ({
    request,
  }) => {
    const res = await request.post(`${base}/api/cart/merge`, {
      data: {
        guestLines: [{ variantId: "variant_test", quantity: 1 }],
      },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/orders/return returns 401 without session", async ({
    request,
  }) => {
    const res = await request.post(`${base}/api/orders/return`, {
      data: {
        orderId: "order_test",
        items: [{ item_id: "item_test", quantity: 1 }],
      },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
  });
});
