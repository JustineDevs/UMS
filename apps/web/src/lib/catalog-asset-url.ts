/**
 * Normalize pasted or catalog-stored URLs so `<img>` / `<video>` and preview logic get stable absolute URLs.
 */

export function normalizeCatalogAssetUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    if (t.startsWith("//")) return new URL(`https:${t}`).href;
    return new URL(t).href;
  } catch {
    return t;
  }
}

/**
 * Gallery lines can be YouTube, direct video, or image URLs (e.g. from catalog). Used for realtime preview.
 */
export function inferCatalogGalleryMediaKind(url: string): "image" | "video" {
  const normalized = normalizeCatalogAssetUrl(url);
  const full = normalized.toLowerCase();
  if (
    /youtube\.com\/(watch|embed|shorts)|youtu\.be\//.test(full) ||
    /vimeo\.com\//.test(full)
  ) {
    return "video";
  }
  let pathname = full;
  try {
    pathname = new URL(normalized).pathname;
  } catch {
    pathname = full;
  }
  if (/\.(png|jpe?g|gif|webp|avif|svg|bmp)(?:\?|$)/i.test(pathname)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogv|ogg)(?:\?|$)/i.test(pathname)) return "video";
  return "video";
}

export function isDirectVideoFileUrl(url: string): boolean {
  const normalized = normalizeCatalogAssetUrl(url);
  let pathname = normalized.toLowerCase();
  try {
    pathname = new URL(normalized).pathname;
  } catch {
    pathname = normalized;
  }
  return /\.(mp4|webm|mov|m4v|ogv|ogg)(?:\?|$)/i.test(pathname);
}
