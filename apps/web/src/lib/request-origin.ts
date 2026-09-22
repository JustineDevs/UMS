/** Reject explicit cross-site browser mutations while allowing non-browser callers without Origin. */
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

function sameOriginOrLoopbackAlias(origin: URL, requestUrl: URL): boolean {
  if (origin.origin === requestUrl.origin) return true;
  return (
    origin.protocol === requestUrl.protocol &&
    origin.port === requestUrl.port &&
    isLoopbackHost(origin.hostname) &&
    isLoopbackHost(requestUrl.hostname)
  );
}

function isConfiguredDevelopmentOrigin(origin: URL): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const configured = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.some((host) => {
    const normalizedHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return origin.hostname.toLowerCase() === normalizedHost && origin.protocol === "https:";
  });
}

export function isSameOriginMutation(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase();
  const origin = req.headers.get("origin")?.trim();
  // Some local browsers report `cross-site` when the page and request use
  // different loopback aliases (localhost vs 127.0.0.1).  The explicit Origin
  // check below already validates that boundary, so only reject cross-site
  // metadata outright when no Origin is available to validate.
  if (fetchSite === "cross-site" && !origin) return false;
  if (!origin) return true;

  try {
    const requestUrl = new URL(req.url);
    const parsedOrigin = new URL(origin);
    return (
      sameOriginOrLoopbackAlias(parsedOrigin, requestUrl) ||
      isConfiguredDevelopmentOrigin(parsedOrigin)
    );
  } catch {
    return false;
  }
}
