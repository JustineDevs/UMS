import "../runtime-logs-init";
import { test, type APIRequestContext } from "@playwright/test";

export function storefrontHttpBase(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
}

function workerHttpBase(): string {
  return (
    process.env.PLAYWRIGHT_WORKER_URL ??
    process.env.API_URL ??
    "http://127.0.0.1:8787"
  ).replace(/\/$/, "");
}

export async function skipUnlessStorefrontReachable(
  request: APIRequestContext,
): Promise<void> {
  const base = storefrontHttpBase();
  const res = await request
    .get(`${base}/api/health`, { failOnStatusCode: false })
    .catch(() => null);
  if (!res?.ok()) {
    test.skip(true, `Storefront not reachable at ${base} (start Next storefront)`);
  }
}

async function skipUnlessWorkerReachable(
  request: APIRequestContext,
): Promise<void> {
  const base = workerHttpBase();
  const res = await request
    .get(`${base}/healthz`, { failOnStatusCode: false })
    .catch(() => null);
  if (!res?.ok()) {
    test.skip(true, `Cloudflare Worker not reachable at ${base}`);
  }
}
