/** Returns a YouTube embed URL, or null if the string is not a recognized YouTube link. */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const embed = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embed?.[1]) return `https://www.youtube.com/embed/${embed[1]}`;
      const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Same as youtubeEmbedUrl, with storefront-friendly autoplay params (muted required by browsers).
 */
export function youtubeEmbedUrlAutoplay(url: string): string | null {
  const base = youtubeEmbedUrl(url);
  if (!base) return null;
  try {
    const u = new URL(base);
    u.searchParams.set("autoplay", "1");
    u.searchParams.set("mute", "1");
    u.searchParams.set("playsinline", "1");
    u.searchParams.set("rel", "0");
    return u.toString();
  } catch {
    return `${base}${base.includes("?") ? "&" : "?"}autoplay=1&mute=1&playsinline=1&rel=0`;
  }
}

export function isDirectVideoUrl(url: string): boolean {
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url)) return true;
  try {
    const u = new URL(url);
    if (
      u.pathname.includes("/storage/v1/object/public/") &&
      /\/(catalog|cms)\//.test(u.pathname)
    ) {
      return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(u.pathname);
    }
  } catch {
    return false;
  }
  return false;
}

/** Extract YouTube video id for poster thumbnails, or null. */
function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const embed = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embed?.[1]) return embed[1];
      const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shorts?.[1]) return shorts[1];
    }
  } catch {
    return null;
  }
  return null;
}

/** Static thumbnail URL for YouTube slides (no API key). */
export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * True when the URL path looks like a raster or SVG still image.
 * Catalog often stores image URLs in `gallery_video_urls`; feeding those to `<video>` fails and shows the error fallback.
 */
export function urlLooksLikeRasterImage(url: string): boolean {
  const s = url.trim();
  if (!s) return false;
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(s)) return true;
  try {
    const u = new URL(s);
    return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Normalize slide kind when metadata lists an image URL as "video".
 */
export function effectiveGallerySlideKind(
  slide: { kind: "image" | "video"; url: string },
): "image" | "video" {
  if (slide.kind === "image") return "image";
  if (urlLooksLikeRasterImage(slide.url)) return "image";
  return "video";
}
