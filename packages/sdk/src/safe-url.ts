/**
 * Accept only URLs that are safe to navigate to or place in a share action.
 * This is intentionally a pure helper so server responses and browser actions
 * use the same validation rules.
 */
export function sanitizeSafeUrl(
  value: unknown,
  options: {
    baseUrl?: string;
    allowedOrigins?: readonly string[];
    requireHttps?: boolean;
    allowRelative?: boolean;
  } = {},
): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (/^[\u0000-\u001f\u007f]/.test(raw) || /[\u0000-\u001f\u007f]/.test(raw)) {
    return null;
  }

  const base = options.baseUrl ?? "http://localhost";
  let parsed: URL;
  try {
    parsed = new URL(raw, base);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (options.requireHttps && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || parsed.port === "0") return null;

  const isRelative = !/^[a-z][a-z\d+.-]*:/i.test(raw) && !raw.startsWith("//");
  if (isRelative && options.allowRelative === false) return null;

  const allowedOrigins = options.allowedOrigins?.map((origin) => {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }).filter((origin): origin is string => Boolean(origin));
  if (allowedOrigins?.length && !allowedOrigins.includes(parsed.origin)) return null;

  // Fragments are never sent to the server and can contain untrusted state.
  parsed.hash = "";
  return parsed.toString();
}

export function sanitizeSameOriginUrl(value: unknown, origin: string): string | null {
  return sanitizeSafeUrl(value, {
    baseUrl: origin,
    allowedOrigins: [origin],
    allowRelative: true,
  });
}

export function sanitizeTrustedPublicUrl(
  value: unknown,
  allowedOrigins: readonly string[] = [],
): string | null {
  const safe = sanitizeSafeUrl(value, {
    allowedOrigins,
    requireHttps: false,
    allowRelative: false,
  });
  if (!safe) return null;
  const parsed = new URL(safe);
  if (parsed.protocol === "https:") return safe;
  return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
    ? safe
    : null;
}
