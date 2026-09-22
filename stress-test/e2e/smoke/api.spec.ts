import { test, expect } from "@playwright/test";
import { apiBaseUrl, skipUnlessApiHealthy } from "../helpers/api";

test.describe("Cloudflare Worker API smoke", () => {
  test("GET /healthz identifies the active backend runtime", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const response = await request.get(`${apiBaseUrl()}/healthz`);
    expect(response.ok(), `healthz failed: ${response.status()}`).toBeTruthy();
    expect(await response.json()).toMatchObject({
      status: "ok",
      runtime: "cloudflare_worker",
    });
  });

  test("GET /readyz exposes readiness without mislabeling database failures", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const response = await request.get(`${apiBaseUrl()}/readyz`, {
      failOnStatusCode: false,
    });
    expect([200, 503]).toContain(response.status());
    const body = (await response.json()) as {
      status?: string;
      runtime?: string;
      databaseRoles?: unknown;
    };
    expect(body.runtime).toBe("cloudflare_worker");
    expect(["ok", "not_ready"]).toContain(body.status);
    expect(body).toHaveProperty("databaseRoles");
  });

  test("compliance export rejects unauthenticated access", async ({ request }) => {
    await skipUnlessApiHealthy(request);
    const response = await request.get(
      `${apiBaseUrl()}/compliance/export?email=test@example.invalid`,
      { failOnStatusCode: false },
    );
    expect(response.status()).toBe(401);
  });
});
