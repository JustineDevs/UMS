import "../runtime-logs-init";
import { test, type APIRequestContext } from "@playwright/test";

export function apiBaseUrl(): string {
  return (
    process.env.PLAYWRIGHT_WORKER_URL ??
    process.env.API_URL ??
    "http://127.0.0.1:8787"
  );
}

export async function skipUnlessApiHealthy(
  request: APIRequestContext,
): Promise<void> {
  const base = apiBaseUrl();
  const res = await request
    .get(`${base}/healthz`, { failOnStatusCode: false })
    .catch(() => null);
  if (!res) {
    test.skip(true, `Cloudflare Worker not reachable at ${base}: start the Worker for this test`);
  }
}
