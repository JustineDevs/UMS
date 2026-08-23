/** Reject explicit cross-site browser mutations while allowing non-browser callers without Origin. */
function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
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

export function isSameOriginMutation(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = req.headers.get("origin")?.trim();
  if (!origin) return true;

  try {
    const requestUrl = new URL(req.url);
    return sameOriginOrLoopbackAlias(new URL(origin), requestUrl);
  } catch {
    return false;
  }
}
