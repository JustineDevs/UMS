export function resolveTrackingPath(value: string, requestUrl: string): string | null {
  try {
    const parsed = new URL(value, requestUrl);
    if (parsed.search || parsed.hash) return null;
    const match = parsed.pathname.match(/^\/track\/(cap_[^/]+)$/);
    if (!match) return null;
    return `/track/${encodeURIComponent(decodeURIComponent(match[1]))}`;
  } catch {
    return null;
  }
}
