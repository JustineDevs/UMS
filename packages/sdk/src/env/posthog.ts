const DEFAULT_POSTHOG_HOST = "https://app.posthog.com";

function stripTrailingSlash(raw: string): string {
  return raw.replace(/\/$/, "");
}

export function getPostHogProjectToken(): string | undefined {
  const token =
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    process.env.POSTHOG_PROJECT_TOKEN?.trim();
  return token || undefined;
}

export function getPostHogApiKey(): string | undefined {
  // `/capture/` accepts a project token, not a personal PostHog API key
  // (`phx_...`). Prefer the canonical project token when both are present and
  // ignore a management key rather than sending it to the capture endpoint.
  const projectToken = getPostHogProjectToken();
  if (projectToken) return projectToken;
  const apiKey = process.env.POSTHOG_API_KEY?.trim();
  return apiKey?.startsWith("phc_") ? apiKey : undefined;
}

export function getPostHogHost(): string {
  const host =
    process.env.POSTHOG_HOST?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    DEFAULT_POSTHOG_HOST;
  return stripTrailingSlash(host) || DEFAULT_POSTHOG_HOST;
}

export function listMissingPostHogEnv(): string[] {
  const missing: string[] = [];
  if (!getPostHogProjectToken()) {
    missing.push(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN (or NEXT_PUBLIC_POSTHOG_KEY / POSTHOG_PROJECT_TOKEN)",
    );
  }
  if (!getPostHogApiKey()) {
    missing.push("POSTHOG_API_KEY");
  }
  if (!getPostHogHost()) {
    missing.push("NEXT_PUBLIC_POSTHOG_HOST (or POSTHOG_HOST)");
  }
  return missing;
}

export function assertPostHogEnvProduction(scope: string): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const missing = listMissingPostHogEnv();
  if (missing.length > 0) {
    throw new Error(
      `${scope}: required PostHog env missing: ${missing.join("; ")}.`,
    );
  }
}
