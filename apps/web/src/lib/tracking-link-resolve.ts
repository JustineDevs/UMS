export function decodeTrackingPathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return null;
  }
}

export function resolveTrackingPath(value: string, requestUrl: string): string | null {
  try {
    const base = new URL(requestUrl);
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return null;
    if (parsed.search || parsed.hash) return null;
    const match = parsed.pathname.match(/^\/track\/(cap_[^/]+)$/);
    if (!match) return null;
    const decoded = decodeTrackingPathSegment(match[1]);
    return decoded ? `/track/${encodeURIComponent(decoded)}` : null;
  } catch {
    return null;
  }
}
