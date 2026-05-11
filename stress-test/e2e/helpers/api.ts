import "../runtime-logs-init";
import { test, type APIRequestContext } from "@playwright/test";

export function apiBaseUrl(): string {
  return process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
}

export async function skipUnlessApiHealthy(
  request: APIRequestContext,
): Promise<void> {
  const base = apiBaseUrl();
  const res = await request
    .get(`${base}/health`, { failOnStatusCode: false })
    .catch(() => null);
  if (!res) {
    test.skip(true, `API not reachable at ${base}: start API for this test`);
  }
}
