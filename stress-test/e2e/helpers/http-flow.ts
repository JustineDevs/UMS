import "../runtime-logs-init";
import { test, type APIRequestContext } from "@playwright/test";

export function storefrontHttpBase(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
}

export function medusaHttpBase(): string {
  return (
    process.env.PLAYWRIGHT_MEDUSA_URL?.replace(/\/health\/?$/, "") ??
    process.env.NEXT_PUBLIC_MEDUSA_URL?.trim().replace(/\/$/, "") ??
    process.env.MEDUSA_BACKEND_URL?.trim().replace(/\/$/, "") ??
    "http://localhost:9000"
  );
}

export function internalApiKey(): string | undefined {
  return process.env.INTERNAL_API_KEY?.trim() || undefined;
}

export function medusaPublishableKey(): string | undefined {
  return (
    process.env.PLAYWRIGHT_MEDUSA_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim() ||
    process.env.MEDUSA_PUBLISHABLE_API_KEY?.trim() ||
    undefined
  );
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

export async function skipUnlessMedusaReachable(
  request: APIRequestContext,
): Promise<void> {
  const base = medusaHttpBase();
  const res = await request
    .get(`${base}/health`, { failOnStatusCode: false })
    .catch(() => null);
  if (!res?.ok()) {
    test.skip(true, `Medusa not reachable at ${base}`);
  }
}
