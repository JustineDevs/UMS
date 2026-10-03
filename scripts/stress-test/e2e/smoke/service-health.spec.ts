/**
 * @smoke
 * Health gates for the deployed topology: Cloudflare Worker backend and Vercel app.
 */
import "../runtime-logs-init";
import { test, expect } from "@playwright/test";
import { apiBaseUrl } from "../helpers/api";

const STOREFRONT_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("@smoke deployed topology health", () => {
  test("Cloudflare Worker GET /healthz returns healthy runtime", async ({ request }) => {
    const response = await request.get(`${apiBaseUrl()}/healthz`, {
      failOnStatusCode: false,
    });
    expect(response.status(), `Worker /healthz -> ${response.status()}`).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      runtime: "cloudflare_worker",
    });
  });

  test("storefront GET /api/health returns healthy service envelope", async ({ request }) => {
    const response = await request.get(`${STOREFRONT_URL}/api/health`, {
      failOnStatusCode: false,
    });
    expect(response.status(), `storefront /api/health -> ${response.status()}`).toBe(200);
    expect(await response.json()).toMatchObject({ service: "storefront", status: "ok" });
  });

  test("storefront admin route responds or redirects to authentication", async ({ request }) => {
    const response = await request.get(`${STOREFRONT_URL}/admin`, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(400);
  });
});
