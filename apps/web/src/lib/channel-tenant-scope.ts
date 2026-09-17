const CHANNEL_TENANT_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Admin channel queries must use the server-configured integration scope.
 * The local fallback keeps AUTH_DISABLED development usable without widening
 * any deployed environment.
 */
export function getChannelTenantKey(
  env: Partial<Record<"CHANNEL_TENANT_KEY" | "NODE_ENV", string | undefined>> = process.env,
): string | null {
  const configured = env.CHANNEL_TENANT_KEY?.trim();
  if (configured && CHANNEL_TENANT_KEY_PATTERN.test(configured)) return configured;
  return env.NODE_ENV === "production" ? null : "default";
}
