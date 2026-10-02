import "./runtime-logs-init";
import { test, expect } from "@playwright/test";

/**
 * Smoke: storefront responds when dev servers are up (see root playwright.config webServer).
 * Tag: @smoke — `pnpm test:e2e:smoke`
 */
test("@smoke storefront health returns JSON ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as { status?: string };
  expect(json.status).toBe("ok");
});
