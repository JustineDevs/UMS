/**
 * Normalize a storefront Instagram value to an https href.
 * Accepts full URL, @handle, or bare handle.
 */
export function normalizeInstagramHref(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("@")) return `https://instagram.com/${trimmed.slice(1)}`;
  return `https://instagram.com/${trimmed.replace(/^\/+/, "")}`;
}

/** @deprecated Prefer server-loaded metadata via getCachedPublicSiteMetadata + normalizeInstagramHref */
function getInstagramHref(): string | undefined {
  return normalizeInstagramHref(process.env.NEXT_PUBLIC_INSTAGRAM_URL);
}

/** @deprecated Prefer server-loaded metadata */
function getSupportEmail(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return raw && raw.includes("@") ? raw : undefined;
}

/** @deprecated Prefer server-loaded metadata */
function getSupportPhoneDisplay(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim();
  return raw || undefined;
}
