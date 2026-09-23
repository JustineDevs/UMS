export type InvalidationSecretEnv = Record<string, string | undefined>;

export function resolveInternalInvalidationSecret(
  env: InvalidationSecretEnv = process.env,
): string | undefined {
  const configured = env.STOREFRONT_INTERNAL_INVALIDATION_SECRET?.trim();
  if (configured) return configured;
  // The Playwright secret exists only to bootstrap local E2E state. It must
  // never become a production authorization fallback.
  if (env.NODE_ENV === "production") return undefined;
  return env.__PLAYWRIGHT_STOREFRONT_INVALIDATION_SECRET?.trim() || undefined;
}
