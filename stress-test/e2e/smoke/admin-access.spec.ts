import "../runtime-logs-init";
import { test, expect } from "@playwright/test";

const adminBase =
  process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

test.describe("Admin access control", () => {
  test("unauthenticated visit to /admin is redirected away from dashboard", async ({
    page,
  }) => {
    await page.goto(`${adminBase}/admin`, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/admin\/(orders|inventory|pos)/, {
      timeout: 5_000,
    });
    await expect(page).toHaveURL(/signin|sign-in|callback|error|auth/i, {
      timeout: 20_000,
    });
  });

  test("POS API returns 401 when no session", async ({ request }) => {
    const res = await request.post(`${adminBase}/api/pos/medusa/lookup`, {
      data: { barcode: "test" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(body).toMatchObject({ code: "NO_SESSION" });
  });

  test("Medusa BFF API returns 401 when no session", async ({ request }) => {
    const res = await request.patch(
      `${adminBase}/api/medusa/orders/order_test123`,
      {
        data: { status: "pending" },
        failOnStatusCode: false,
      },
    );
    expect(res.status()).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(body).toMatchObject({ code: "NO_SESSION" });
  });
});
