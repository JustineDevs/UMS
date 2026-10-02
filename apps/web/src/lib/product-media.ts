/** Returns a YouTube embed URL, or null if the string is not a recognized YouTube link. */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

function normalizeYoutubeId(value: string | null | undefined): string | null {
  const id = value?.trim() ?? "";
  return YOUTUBE_ID_PATTERN.test(id) ? id : null;
}

export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = normalizeYoutubeId(u.pathname.slice(1).split("/")[0]);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtube.com" || u.hostname === "www.youtube.com") {
      const v = normalizeYoutubeId(u.searchParams.get("v"));
      if (v) return `https://www.youtube.com/embed/${v}`;
      const embed = u.pathname.match(/\/embed\/([^/?]+)/);
      const embedId = normalizeYoutubeId(embed?.[1]);
      if (embedId) return `https://www.youtube.com/embed/${embedId}`;
      const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
      const shortsId = normalizeYoutubeId(shorts?.[1]);
      if (shortsId) return `https://www.youtube.com/embed/${shortsId}`;
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
      const id = normalizeYoutubeId(u.pathname.slice(1).split("/")[0]);
      return id || null;
    }
    if (u.hostname === "youtube.com" || u.hostname === "www.youtube.com") {
      const v = normalizeYoutubeId(u.searchParams.get("v"));
      if (v) return v;
      const embed = u.pathname.match(/\/embed\/([^/?]+)/);
      const embedId = normalizeYoutubeId(embed?.[1]);
      if (embedId) return embedId;
      const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
      const shortsId = normalizeYoutubeId(shorts?.[1]);
      if (shortsId) return shortsId;
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
