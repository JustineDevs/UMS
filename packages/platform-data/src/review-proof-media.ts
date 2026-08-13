export type ReviewProofMediaKind = "image" | "video" | "link";

export interface ReviewProofMedia {
  kind: ReviewProofMediaKind;
  url: string;
}

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

const VIDEO_EXTENSIONS = new Set(["m4v", "mkv", "mov", "mp4", "ogg", "webm"]);

const LINK_VIDEO_HOSTS = [
  "youtu.be",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "vimeo.com",
  "www.vimeo.com",
  "loom.com",
  "www.loom.com",
];

function getUrlExtension(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    const idx = last.lastIndexOf(".");
    return idx >= 0 ? last.slice(idx + 1).toLowerCase() : "";
  } catch {
    const cleaned = url.split(/[?#]/)[0] ?? "";
    const idx = cleaned.lastIndexOf(".");
    return idx >= 0 ? cleaned.slice(idx + 1).toLowerCase() : "";
  }
}

export function inferReviewProofMedia(url?: string | null): ReviewProofMedia | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }

  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("data:image/")) {
    return { kind: "image", url: trimmed };
  }
  if (lowered.startsWith("data:video/")) {
    return { kind: "video", url: trimmed };
  }

  const extension = getUrlExtension(trimmed);
  if (IMAGE_EXTENSIONS.has(extension)) {
    return { kind: "image", url: trimmed };
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return { kind: "video", url: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (LINK_VIDEO_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`))) {
      return { kind: "link", url: trimmed };
    }
  } catch {
    // Fall through to a link-style preview for opaque URLs.
  }

  return { kind: "link", url: trimmed };
}
