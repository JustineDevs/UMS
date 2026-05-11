/**
 * @smoke
 * Service health smoke test — asserts all four services return 200 before
 * any other test suite runs. Tagged @smoke so it can be run in isolation:
 *   pnpm exec playwright test --grep "@smoke"
 */
import "../runtime-logs-init";
import { test, expect } from "@playwright/test";

const MEDUSA_URL = process.env.PLAYWRIGHT_MEDUSA_URL ?? "http://localhost:9000";
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const STOREFRONT_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ADMIN_URL = process.env.PLAYWRIGHT_ADMIN_URL ?? "http://localhost:3001";

test.describe("@smoke Service health checks", () => {
  test("apps/medusa GET /health returns 200", async ({ request }) => {
    const res = await request.get(`${MEDUSA_URL}/health`, {
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      `apps/medusa :9000/health → expected 200, got ${res.status()}`,
    ).toBe(200);
  });

  test("apps/api GET /health returns 200", async ({ request }) => {
    const res = await request.get(`${API_URL}/health`, {
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      `apps/api :4000/health → expected 200, got ${res.status()}`,
    ).toBe(200);
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBe("ok");
  });

  test("apps/storefront GET /api/health returns 200 with status ok", async ({ request }) => {
    const res = await request.get(`${STOREFRONT_URL}/api/health`, {
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      `apps/storefront :3000/api/health → expected 200, got ${res.status()}`,
    ).toBe(200);
    const body = (await res.json()) as { service?: string; status?: string };
    expect(body.service).toBe("storefront");
    expect(body.status).toBe("ok");
  });

  test("apps/admin GET root returns 200 or 3xx", async ({ request }) => {
    const res = await request.get(`${ADMIN_URL}`, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    const status = res.status();
    expect(
      status >= 200 && status < 400,
      `apps/admin :3001 → expected 200-3xx, got ${status}`,
    ).toBeTruthy();
  });
});
