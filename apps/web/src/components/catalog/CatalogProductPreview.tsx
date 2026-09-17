"use client";

import { useEffect, useState } from "react";
import { isDirectVideoFileUrl } from "@/lib/catalog-asset-url";
import {
  buildCatalogPreviewModel,
  type CatalogPreviewModelInput,
} from "./catalog-preview-model";

export type CatalogPreviewLayoutDensity = "compact" | "comfortable" | "spacious";

type Props = CatalogPreviewModelInput & {
  /** Driven by parent workspace width (e.g. collapsible activity sidebar). */
  layoutDensity?: CatalogPreviewLayoutDensity;
};

type PreviewMode = "card" | "pdp";
type PreviewViewport = "mobile" | "desktop";

function SegmentTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] min-w-[3rem] touch-manipulation rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "bg-white text-primary shadow-sm"
          : "text-on-surface-variant hover:bg-white/70 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function CardHeroImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (failed) {
    return (
      <div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 bg-surface-container-low px-3 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Image unavailable
        </span>
        <span className="max-w-[200px] text-[11px] leading-snug text-on-surface-variant">
          Check the address in the form, or use a public web link.
        </span>
      </div>
    );
  }
  return (
    // Preview URLs are user-supplied and may point to any approved external host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function StatusPill({ status }: { status: "draft" | "published" }) {
  if (status === "published") {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
        Published
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900">
      Draft preview
    </span>
  );
}

function StageImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-container-low px-3 text-center text-xs text-on-surface-variant">
        This picture could not be loaded
      </div>
    );
  }
  return (
    // Preview URLs are user-supplied and may point to any approved external host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function StageDirectVideo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-950 px-3 text-center text-xs text-white/80">
        This clip could not be loaded. Try another file or link.
      </div>
    );
  }
  return (
    <video
      src={src}
      className="h-full w-full object-cover"
      controls
      muted
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
    />
  );
}

function MediaFrame({
  activeIndex,
  onChange,
  media,
  title,
  layoutDensity,
}: {
  activeIndex: number;
  onChange: (_index: number) => void;
  media: ReturnType<typeof buildCatalogPreviewModel>["media"];
  title: string;
  layoutDensity: CatalogPreviewLayoutDensity;
}) {
  const active = media[activeIndex];
  const stageClass =
    layoutDensity === "compact"
      ? "relative w-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low aspect-[3/4] max-h-[min(340px,42svh)]"
      : layoutDensity === "spacious"
        ? "relative w-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low aspect-[3/4] max-h-[min(480px,58svh)]"
        : "relative w-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low aspect-[3/4] max-h-[min(420px,50svh)]";
  return (
    <div className="space-y-3">
      <div className={stageClass}>
        {active?.kind === "image" ? (
          <StageImage src={active.url} alt={title} />
        ) : active?.kind === "video" && isDirectVideoFileUrl(active.url) ? (
          <StageDirectVideo src={active.url} />
        ) : active?.kind === "video" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-white">
            <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
              Clip
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-white/80">
              Embedded or hosted clip. File-based clips play in the large view above. This matches
              how the shop will show it.
            </p>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-on-surface-variant">
            Add product media to preview the gallery.
          </div>
        )}
      </div>

      {media.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {media.map((item, idx) => (
            <button
              key={`${item.kind}-${item.url}-${idx}`}
              type="button"
              onClick={() => onChange(idx)}
              aria-label={`Show item ${idx + 1}`}
              className={`relative h-16 min-h-[44px] w-14 shrink-0 overflow-hidden rounded-xl border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                idx === activeIndex
                  ? "border-primary ring-1 ring-primary"
                  : "border-outline-variant/20"
              }`}
            >
              {item.kind === "image" ? (
                // Thumbnails use arbitrary catalog URLs; next/image would require an open-ended host allow-list.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              ) : item.kind === "video" && isDirectVideoFileUrl(item.url) ? (
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-950 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-white">
                  Clip
                </div>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CatalogProductPreview(props: Props) {
  const { layoutDensity = "comfortable", ...previewInput } = props;
  const model = buildCatalogPreviewModel(previewInput);
  const [mode, setMode] = useState<PreviewMode>("card");
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [selectedSize, setSelectedSize] = useState(model.defaultSize);
  const [selectedColor, setSelectedColor] = useState(model.defaultColor);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    if (!model.sizes.includes(selectedSize)) {
      setSelectedSize(model.defaultSize);
    }
  }, [model.defaultSize, model.sizes, selectedSize]);

  useEffect(() => {
    if (!model.colors.includes(selectedColor)) {
      setSelectedColor(model.defaultColor);
    }
  }, [model.colors, model.defaultColor, selectedColor]);

  useEffect(() => {
    if (activeMediaIndex >= model.media.length) {
      setActiveMediaIndex(0);
    }
  }, [activeMediaIndex, model.media.length]);

  const selectedVariant =
    model.variants.find(
      (variant) =>
        variant.size === selectedSize && variant.color === selectedColor,
    ) ?? model.variants[0];

  const frameWidth =
    viewport === "mobile" ? "mx-auto w-full max-w-[360px]" : "w-full min-w-0";

  const shellPad =
    layoutDensity === "compact"
      ? "p-2.5 sm:p-3 lg:p-3"
      : layoutDensity === "spacious"
        ? "p-4 sm:p-5 lg:p-5"
        : "p-3 sm:p-4 lg:p-4";

  const cardMax =
    layoutDensity === "compact"
      ? "max-w-[280px]"
      : layoutDensity === "spacious"
        ? "max-w-[340px]"
        : "max-w-[320px]";

  const innerPad =
    layoutDensity === "compact"
      ? "p-2.5 shadow-sm sm:p-3"
      : layoutDensity === "spacious"
        ? "p-4 shadow-sm sm:p-5"
        : "p-3 shadow-sm sm:p-4";

  const pdpTitleClass =
    layoutDensity === "compact"
      ? "text-2xl font-headline font-bold tracking-tight text-primary sm:text-3xl"
      : "text-3xl font-headline font-bold tracking-tight text-primary sm:text-4xl";

  return (
    <section
      aria-label="Storefront catalog preview"
      className={`rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 ${shellPad}`}
    >
      <div className="flex flex-col gap-3 border-b border-outline-variant/15 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Real-time preview
          </p>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
            Reflects unsaved fields. Pick layout and viewport below.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div
            className="inline-flex w-full max-w-full rounded-xl border border-outline-variant/25 bg-surface-container-low/80 p-1 sm:w-auto"
            role="group"
            aria-label="Preview layout"
          >
            <SegmentTab active={mode === "card"} onClick={() => setMode("card")}>
              Card
            </SegmentTab>
            <SegmentTab active={mode === "pdp"} onClick={() => setMode("pdp")}>
              PDP
            </SegmentTab>
          </div>
          <div
            className="inline-flex w-full max-w-full rounded-xl border border-outline-variant/25 bg-surface-container-low/80 p-1 sm:w-auto"
            role="group"
            aria-label="Preview viewport"
          >
            <SegmentTab
              active={viewport === "mobile"}
              onClick={() => setViewport("mobile")}
            >
              Mobile
            </SegmentTab>
            <SegmentTab
              active={viewport === "desktop"}
              onClick={() => setViewport("desktop")}
            >
              Desktop
            </SegmentTab>
          </div>
        </div>
      </div>

      <div className={`mt-3 rounded-2xl border border-outline-variant/15 bg-white ${innerPad}`}>
        <div className={`${frameWidth}`}>
          {mode === "card" ? (
            <div
              className={`mx-auto w-full ${cardMax} overflow-hidden rounded-2xl border border-outline-variant/15 bg-white shadow-sm`}
            >
              <div className="relative">
                <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-2">
                  <StatusPill status={model.status} />
                </div>
                {model.sizes.length > 0 ? (
                  <div className="absolute right-2.5 top-2.5 z-10 rounded-full border border-outline-variant/25 bg-white/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary shadow-sm">
                    Sizes
                  </div>
                ) : null}
                <div className="h-[200px] w-full bg-surface-container-low sm:h-[220px]">
                  {model.media[activeMediaIndex]?.kind === "image" ? (
                    <CardHeroImage
                      src={model.media[activeMediaIndex]!.url}
                      alt={model.title}
                    />
                  ) : model.media[activeMediaIndex]?.kind === "video" &&
                    isDirectVideoFileUrl(model.media[activeMediaIndex]!.url) ? (
                    <video
                      src={model.media[activeMediaIndex]!.url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : model.media[activeMediaIndex]?.kind === "video" ? (
                    <div className="flex h-full w-full items-center justify-center bg-slate-950 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                      Clip preview
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-on-surface-variant">
                      No media yet
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-outline-variant/10 bg-primary py-2 text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                  View product
                </span>
              </div>
              <div className="space-y-2 px-4 pb-4 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-headline text-base font-bold uppercase leading-tight text-primary">
                      {model.title}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                      {selectedVariant?.color ?? model.defaultColor}
                    </p>
                  </div>
                  <span className="shrink-0 font-headline text-base font-semibold text-primary">
                    {model.cardPriceLabel}
                  </span>
                </div>
                {model.categoryLabels.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {model.categoryLabels.slice(0, 3).map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-surface-container-low px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid min-w-0 gap-6">
              <MediaFrame
                activeIndex={activeMediaIndex}
                onChange={setActiveMediaIndex}
                media={model.media}
                title={model.title}
                layoutDensity={layoutDensity}
              />

              <div className="min-w-0 space-y-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {model.categoryLabels[0] ? (
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                        {model.categoryLabels[0]}
                      </span>
                    ) : null}
                    <StatusPill status={model.status} />
                  </div>
                  {model.brand ? (
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-on-surface-variant">
                      {model.brand}
                    </p>
                  ) : null}
                  <h3 className={pdpTitleClass}>
                    {model.title}
                  </h3>
                  <p className="text-lg text-on-surface-variant">{model.priceLabel}</p>
                  <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                    {model.description}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface">
                      Color:{" "}
                      <span className="font-normal text-secondary">
                        {selectedVariant?.color ?? model.defaultColor}
                      </span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {model.colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                            selectedColor === color
                              ? "border-primary bg-primary text-white"
                              : "border-outline-variant/30 bg-white text-on-surface-variant"
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-end justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface">
                        Size
                      </p>
                      <span className="text-xs text-on-surface-variant">Select one</span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {model.sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`rounded-xl px-3 py-3 text-sm font-medium transition ${
                            selectedSize === size
                              ? "bg-primary text-white"
                              : "bg-surface-container-low text-on-surface"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/40 p-4 text-sm text-on-surface-variant">
                    <p className="font-medium text-on-surface">Selected variant</p>
                    <p className="mt-1">{selectedVariant?.label ?? "No variant combination yet"}</p>
                  </div>

                  {model.categoryLabels.length > 0 ? (
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                        Category labels
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {model.categoryLabels.map((category) => (
                          <span
                            key={category}
                            className="rounded-full border border-outline-variant/20 bg-white px-3 py-1.5 text-xs font-medium text-on-surface"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      className="min-h-[50px] flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
                    >
                      Preview add to bag
                    </button>
                    <button
                      type="button"
                      className="min-h-[50px] rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant"
                    >
                      Wishlist
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
