/**
 * Accept only storefront origins that are owned by this deployment.
 * Explicitly listing the dev alias prevents preview OAuth from falling back
 * to the production origin when Vercel does not preserve the forwarded host.
 */
export function isAllowedBrowserOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return false;
    return (
      url.origin === "https://universalmusic.vercel.app" ||
      url.origin === "https://universalmusic-preview.vercel.app" ||
      url.hostname.endsWith("-justinedevs-projects.vercel.app") ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Preserve the browser-facing deployment origin during OAuth completion. */
export function resolveAuthCallbackOrigin(
  request: Request,
  requestedOrigin: string | null,
): string {
  if (requestedOrigin && isAllowedBrowserOrigin(requestedOrigin)) {
    return new URL(requestedOrigin).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  if (forwardedProto && forwardedHost) {
    try {
      const forwardedOrigin = new URL(`${forwardedProto}://${forwardedHost}`).origin;
      if (isAllowedBrowserOrigin(forwardedOrigin)) return forwardedOrigin;
    } catch {
      // Fall through to the request URL for malformed proxy metadata.
    }
  }

  return new URL(request.url).origin;
}
