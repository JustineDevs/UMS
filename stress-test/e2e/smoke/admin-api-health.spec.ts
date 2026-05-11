/**
 * Admin API route health smoke test.
 * Verifies every admin API route returns 401 without auth, and 200 with
 * valid staff session credentials.
 *
 * Run in isolation:
 *   pnpm exec playwright test stress-test/e2e/smoke/admin-api-health.spec.ts
 */
import "../runtime-logs-init";
import { test, expect } from "@playwright/test";
import { e2eAdminLogin } from "../helpers/admin-e2e-auth";

const base = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

const PUBLIC_GET_ROUTES = [
  "/api/admin/integration-health",
  "/api/admin/payment-health",
];

const AUTH_REQUIRED_GET_ROUTES = [
  "/api/admin/orders",
  "/api/admin/analytics",
  "/api/admin/inventory",
  "/api/admin/payments",
  "/api/admin/loyalty",
  "/api/admin/devices",
  "/api/admin/employees",
  "/api/admin/campaigns",
  "/api/admin/crm",
  "/api/admin/reviews",
  "/api/admin/shifts",
  "/api/admin/receipts",
  "/api/admin/audit-logs",
  "/api/admin/catalog/products",
  "/api/admin/reconciliation",
  "/api/admin/segments",
];

test.describe("Admin API — unauthenticated requests return 401", () => {
  for (const route of AUTH_REQUIRED_GET_ROUTES) {
    test(`GET ${route} returns 401 without session`, async ({ request }) => {
      const res = await request.get(`${base}${route}`, {
        failOnStatusCode: false,
      });
      const status = res.status();
      expect(
        [401, 403].includes(status),
        `${route} without auth → expected 401/403, got ${status}`,
      ).toBeTruthy();
    });
  }
});

test.describe("Admin API — authenticated requests return 200", () => {
  test.skip(
    !process.env.ADMIN_ALLOWED_EMAILS || !process.env.NEXTAUTH_SECRET,
    "Skipped: ADMIN_ALLOWED_EMAILS and NEXTAUTH_SECRET not set",
  );

  for (const route of AUTH_REQUIRED_GET_ROUTES) {
    test(`GET ${route} returns 200 with valid session`, async ({ page, request }) => {
      const result = await e2eAdminLogin(page);
      if (result !== "ok") {
        test.skip(true, `Admin login not available: ${result}`);
        return;
      }

      const cookies = await page.context().cookies();
      const sessionCookie = cookies
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      const res = await request.get(`${base}${route}`, {
        failOnStatusCode: false,
        headers: { Cookie: sessionCookie },
      });
      const status = res.status();
      expect(
        [200, 201, 204].includes(status),
        `${route} with auth → expected 200, got ${status}`,
      ).toBeTruthy();
    });
  }
});

test.describe("Admin API — public routes return 200", () => {
  for (const route of PUBLIC_GET_ROUTES) {
    test(`GET ${route} → 200`, async ({ request }) => {
      const res = await request.get(`${base}${route}`, {
        failOnStatusCode: false,
      });
      const status = res.status();
      expect(
        [200, 204].includes(status),
        `${route} → expected 200, got ${status}`,
      ).toBeTruthy();
    });
  }
});
