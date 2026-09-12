import "../runtime-logs-init";
import { test, expect } from "@playwright/test";

const base =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Storefront commerce API hardening", () => {
  test("raw tracking order ids do not reveal order data without a signed token", async ({
    page,
  }) => {
    await page.goto(`${base}/track/order_untrusted_probe`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Tracking link incomplete" })).toBeVisible();
    await expect(page.getByText("Order untrusted probe", { exact: false })).toHaveCount(0);
  });

  test("raw confirmation order ids do not reveal order data without a signed token", async ({
    page,
  }) => {
    await page.goto(`${base}/order-confirmation/order_untrusted_probe`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Order confirmation unavailable" }),
    ).toBeVisible();
    await expect(page.getByText("Order untrusted probe", { exact: false })).toHaveCount(0);
  });

  test("forged tracking capability does not reveal order data", async ({ page }) => {
    await page.goto(`${base}/track/order_untrusted_probe?t=forged-token`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Tracking link incomplete" }),
    ).toBeVisible();
    await expect(page.getByText("Order untrusted probe", { exact: false })).toHaveCount(0);
  });

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

  test("cart bind and resume do not accept bearer-like identifiers without session ownership", async ({ request }) => {
    const bind = await request.post(`${base}/api/cart/medusa-bind`, {
      data: { cartId: "cart_01HZABC" },
      failOnStatusCode: false,
    });
    const resume = await request.get(`${base}/api/cart/resume?cartId=cart_01HZABC`, {
      failOnStatusCode: false,
    });
    expect(bind.status()).toBe(403);
    expect(resume.status()).toBe(403);
  });

  test("checkout and recovery telemetry reject cross-site mutations", async ({ request }) => {
    const headers = { Origin: "https://evil.example", Referer: "https://evil.example/form" };
    for (const [path, data] of [
      ["/api/checkout/verify-stock", { lines: [{ variantId: "variant_test", quantity: 1 }] }],
      ["/api/checkout/commerce-telemetry", { event: "checkout_quote_changed" }],
      ["/api/cart/abandonment", { lines: [{ variantId: "variant_test" }] }],
      ["/api/cart/reconcile", { lines: [{ variantId: "variant_test", slug: "probe", quantity: 1 }] }],
      ["/api/tracking-link", { cartId: "cart_01HZABC" }],
    ] as const) {
      const response = await request.post(`${base}${path}`, {
        headers,
        data,
        failOnStatusCode: false,
      });
      expect(response.status(), path).toBe(403);
    }
  });
});
