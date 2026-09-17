"use client";

import { normalizeCatalogAssetUrl } from "@/lib/catalog-asset-url";
import { useState } from "react";

type Props = {
  publicUrl: string;
  mimeType: string | null;
  className?: string;
  /** Shown when preview fails or type is unknown */
  fallbackLabel?: string;
};

function guessKindFromPath(url: string): "image" | "video" | null {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|$)/i.test(path)) return "image";
    if (/\.(mp4|webm|mov|m4v|ogv|ogg)(\?|$)/i.test(path)) return "video";
  } catch {
    return null;
  }
  return null;
}

/**
 * Renders an image or video preview for catalog / CMS media URLs (not raw text).
 */
export function CatalogMediaPreview({
  publicUrl,
  mimeType,
  className = "h-full w-full object-cover",
  fallbackLabel = "File",
}: Props) {
  const [broken, setBroken] = useState(false);
  const src = normalizeCatalogAssetUrl(publicUrl);
  const mime = mimeType?.toLowerCase() ?? "";

  if (!src || broken) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container-high text-[10px] text-on-surface-variant ${className}`}
      >
        {fallbackLabel}
      </div>
    );
  }

  if (mime.startsWith("image/")) {
    return (
      // External catalog URLs are user-supplied and not safely enumerable in next.config.js.
      // Keep the native element so previews work with any approved storage/CDN host.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={className}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    );
  }
  if (mime.startsWith("video/")) {
    return (
      <video
        src={src}
        className={className}
        muted
        playsInline
        preload="metadata"
        onError={() => setBroken(true)}
      />
    );
  }

  const guessed = guessKindFromPath(src);
  if (guessed === "image") {
    return (
      // Guessed media can come from arbitrary approved catalog/CDN hosts.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={className}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    );
  }
  if (guessed === "video") {
    return (
      <video
        src={src}
        className={className}
        muted
        playsInline
        preload="metadata"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-surface-container-high text-[10px] text-on-surface-variant ${className}`}
    >
      {fallbackLabel}
    </div>
  );
}
