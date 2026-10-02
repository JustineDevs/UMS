export function inferCatalogMediaMimeType(url: string, mimeType: string | null): string | null {
  const declared = mimeType?.trim().toLowerCase();
  if (declared) return declared;

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const imageExtension = path.match(/\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i)?.[1]?.toLowerCase();
    if (imageExtension) {
      return imageExtension === "jpg" || imageExtension === "jpeg"
        ? "image/jpeg"
        : `image/${imageExtension === "svg" ? "svg+xml" : imageExtension}`;
    }
    if (/\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(path)) return "video/*";
    if (["images.unsplash.com", "plus.unsplash.com", "images.pexels.com"].includes(parsed.hostname.toLowerCase())) {
      const format = parsed.searchParams.get("fm") ?? parsed.searchParams.get("format");
      if (format === "webp") return "image/webp";
      if (format === "png") return "image/png";
      return "image/jpeg";
    }
  } catch {
    return null;
  }
  return null;
}
