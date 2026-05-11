import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiBaseUrl, skipUnlessApiHealthy } from "../helpers/api";

async function skipIfApiUnavailable(request: APIRequestContext): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_API === "1") {
    test.skip(true, "PLAYWRIGHT_SKIP_API=1");
    return;
  }
  await skipUnlessApiHealthy(request);
}

test.describe("API smoke", () => {
  test("GET /health returns ok", async ({ request }) => {
    await skipIfApiUnavailable(request);
    const base = apiBaseUrl();
    const res = await request.get(`${base}/health`);
    expect(res.ok(), `health failed: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("medusa");
  });

  test("GET /health/commerce reports Medusa probe", async ({ request }) => {
    await skipIfApiUnavailable(request);
    const base = apiBaseUrl();
    const res = await request.get(`${base}/health/commerce`);
    expect(res.ok(), `health/commerce failed: ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.commerceEngine).toBe("medusa");
    expect(typeof body.timestamp).toBe("string");
  });

  test("GET /compliance/export returns 401 when no internal API key", async ({
    request,
  }) => {
    await skipIfApiUnavailable(request);
    const base = apiBaseUrl();
    const res = await request.get(`${base}/compliance/export?email=test@x.com`, {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(body).toMatchObject({ code: "INVALID_INTERNAL_API_KEY" });
  });
});
