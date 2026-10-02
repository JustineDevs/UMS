"use client";

import { normalizeCatalogAssetUrl } from "@/lib/catalog-asset-url";
import Image from "next/image";
import { useState } from "react";
import { inferCatalogMediaMimeType } from "./catalog-media-mime";

type Props = {
  publicUrl: string;
  mimeType: string | null;
  className?: string;
  /** Shown when preview fails or type is unknown */
  fallbackLabel?: string;
};

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
  const mime = inferCatalogMediaMimeType(src, mimeType) ?? "";

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
      <Image
        src={src}
        alt=""
        width={1}
        height={1}
        unoptimized
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

  const guessed = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : null;
  if (guessed === "image") {
    return (
      <Image
        src={src}
        alt=""
        width={1}
        height={1}
        unoptimized
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
