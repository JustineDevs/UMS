"use client";

import type { ProductGallerySlide } from "@universal-music-store/types";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  effectiveGallerySlideKind,
  urlLooksLikeRasterImage,
  youtubeEmbedUrlAutoplay,
  youtubeThumbnailUrl,
} from "@/lib/product-media";
import {
  isKnownUnavailableExternalImage,
  shouldUnoptimizeImage,
} from "@/lib/image-helpers";
import { ProductImageZoom } from "./ProductImageZoom";

function VideoSlide({ url, title }: { url: string; title: string }) {
  if (urlLooksLikeRasterImage(url)) {
    return (
      <ProductImageZoom
        src={url}
        alt={title}
        sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 50vw, 46vw"
        priority={false}
      />
    );
  }
  const yt = youtubeEmbedUrlAutoplay(url);
  if (yt) {
    return (
      <div className="relative h-full min-h-[inherit] w-full bg-black">
        <iframe
          title={`${title} video`}
          src={yt}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }
  return <HostedVideoPlayer url={url} title={title} />;
}

/** Direct file or Supabase URL: use HTML5 video. Fallback only if load fails (wrong URL or CORS). */
function HostedVideoPlayer({ url, title }: { url: string; title: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 bg-surface-container-high p-6 text-center">
        <p className="text-sm text-on-surface-variant">
          This clip could not play inline. Open it in a new tab.
        </p>
        <a
          href={url}
          className="font-medium text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open link
        </a>
      </div>
    );
  }
  return (
    <video
      title={title}
      controls
      autoPlay
      muted
      playsInline
      loop
      className="h-full w-full object-contain"
      src={url}
      onError={() => setBroken(true)}
    />
  );
}

function GalleryVideoThumbnail({ url }: { url: string }) {
  const poster = youtubeThumbnailUrl(url);
  const [posterFailed, setPosterFailed] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);

  if (urlLooksLikeRasterImage(url)) {
    return (
      isKnownUnavailableExternalImage(url) ? (
        <div className="h-full w-full bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high" />
      ) : (
        <Image
          src={url}
          alt=""
          fill
          sizes="80px"
          className="object-cover"
          unoptimized={shouldUnoptimizeImage(url)}
        />
      )
    );
  }
  if (poster && !posterFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote YouTube poster; not in Next image remotePatterns
      <img
        src={poster}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setPosterFailed(true)}
      />
    );
  }
  if (youtubeEmbedUrlAutoplay(url)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-black px-1 text-center">
        <span className="material-symbols-outlined text-lg text-white" aria-hidden>
          play_circle
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-white/90">
          Video
        </span>
      </div>
    );
  }
  if (thumbBroken) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-surface-container-high px-0.5 text-center">
        <span className="material-symbols-outlined text-base text-on-surface-variant" aria-hidden>
          play_circle
        </span>
      </div>
    );
  }
  return (
    <video
      src={url}
      muted
      playsInline
      preload="metadata"
      className="h-full w-full object-cover"
      aria-hidden
      onError={() => setThumbBroken(true)}
    />
  );
}

export function ProductGalleryCarousel({
  slides,
  productName,
}: {
  slides: ProductGallerySlide[];
  productName: string;
}) {
  const [active, setActive] = useState(0);
  const count = slides.length;
  const safe = count ? Math.min(active, count - 1) : 0;
  const slide = slides[safe];

  const go = useCallback(
    (dir: -1 | 1) => {
      if (!count) return;
      setActive((i) => (i + dir + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (active >= count) setActive(0);
  }, [active, count]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const mainStageClass =
    count > 1
      ? "relative min-w-0 flex-1 overflow-hidden bg-surface-container-low"
      : "relative w-full min-w-0 self-start overflow-hidden bg-surface-container-low";

  if (!count) {
    return (
      <div className="relative h-[500px] w-full self-start bg-surface-container-high md:h-[716px]" />
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
      <div className={mainStageClass}>
        <div className="relative h-[500px] w-full md:h-[716px]">
          {slide && effectiveGallerySlideKind(slide) === "image" ? (
            isKnownUnavailableExternalImage(slide.url) ? (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high p-8 text-center text-sm text-on-surface-variant">
                Image unavailable
              </div>
            ) : (
              <ProductImageZoom
                src={slide.url}
                alt={productName}
                sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 50vw, 46vw"
                priority={safe === 0}
              />
            )
          ) : slide && effectiveGallerySlideKind(slide) === "video" ? (
            <VideoSlide key={slide.url} url={slide.url} title={productName} />
          ) : null}
        </div>
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-md backdrop-blur-sm transition hover:bg-black/60"
              aria-label="Previous image or video"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden>
                chevron_left
              </span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-md backdrop-blur-sm transition hover:bg-black/60"
              aria-label="Next image or video"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden>
                chevron_right
              </span>
            </button>
            <div
              className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5"
              role="tablist"
              aria-label="Gallery position"
            >
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === safe}
                  aria-label={`Slide ${i + 1} of ${count}`}
                  onClick={() => setActive(i)}
                  className={`h-2 w-2 rounded-full transition ${
                    i === safe ? "bg-white" : "bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div
          className="flex gap-3 overflow-x-auto pb-1 md:max-h-[716px] md:w-28 md:flex-col md:overflow-y-auto md:pb-0"
          role="tablist"
          aria-label="Gallery thumbnails"
        >
          {slides.map((s, idx) => (
            <button
              key={`${s.kind}-${idx}-${s.url.slice(0, 40)}`}
              type="button"
              role="tab"
              aria-selected={idx === safe}
              aria-label={
                effectiveGallerySlideKind(s) === "image"
                  ? `Image ${idx + 1}`
                  : `Video ${idx + 1}`
              }
              onClick={() => setActive(idx)}
              className={`relative h-24 w-20 shrink-0 overflow-hidden rounded-md border-2 bg-surface-container-highest transition ${
                idx === safe
                  ? "border-primary ring-1 ring-primary"
                  : "border-transparent opacity-90 hover:opacity-100"
              }`}
            >
              {effectiveGallerySlideKind(s) === "image" ? (
                isKnownUnavailableExternalImage(s.url) ? (
                  <div className="h-full w-full bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high" />
                ) : (
                  <Image
                    src={s.url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized={shouldUnoptimizeImage(s.url)}
                  />
                )
              ) : (
                <GalleryVideoThumbnail url={s.url} />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
