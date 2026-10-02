"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Card, CardContent } from "@universal-music-store/ui";
import type { Product } from "@universal-music-store/types";
import {
  BrowsePriceFreshnessCue,
} from "@/components/BrowsePriceFreshnessCue";
import { buildFreshnessSignature } from "@/components/browse-price-freshness";
import { QuickViewButton } from "@/components/QuickViewButton";
import { trackProductClick } from "@/lib/analytics";
import {
  isKnownUnavailableExternalImage,
  shouldUnoptimizeImage,
} from "@/lib/image-helpers";

type Props = {
  product: Product;
  /** Image rotation interval while the card is hovered (ms). */
  intervalMs?: number;
  /** Mark the first visible card as high priority when it is above the fold. */
  priority?: boolean;
};

export function CatalogProductCard({ product, intervalMs = 3000, priority = false }: Props) {
  const urls: string[] = [];
  const compareAtPrices: number[] = [];
  for (const image of product.images) {
    if (image.imageUrl) urls.push(image.imageUrl);
  }
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const types = [...new Set(product.variants.flatMap((v) => (v.type ? [v.type] : [])))].sort();
  const minPrice = Math.min(...product.variants.map((v) => v.price));
  for (const variant of product.variants) {
    if (typeof variant.compareAtPrice === "number" && variant.compareAtPrice > 0) {
      compareAtPrices.push(variant.compareAtPrice);
    }
  }
  const compareAtPrice = compareAtPrices.length > 0 ? Math.min(...compareAtPrices) : null;
  const isSale = compareAtPrice !== null && compareAtPrice > minPrice;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (urls.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % urls.length);
    }, intervalMs);
  }, [clearTimer, intervalMs, urls.length]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const imageUrl = urls[idx] ?? urls[0];
  const imageUnavailable =
    imageUrl && isKnownUnavailableExternalImage(imageUrl);
  const firstVariant = product.variants[0];
  const initialInventorySignature = buildFreshnessSignature(product.variants);

  return (
    <Card className="overflow-hidden border border-outline-variant/15 bg-surface-container-lowest shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="group relative">
        <Link
          href={`/shop/${product.slug}`}
          className="block"
          data-product-id={product.id}
          data-product-slug={product.slug}
          onClick={() => trackProductClick({ slug: product.slug, id: product.id })}
        >
        <div
          className="relative aspect-square overflow-hidden bg-surface-container-low"
          onMouseEnter={() => {
            setIdx(0);
            startTimer();
          }}
          onMouseLeave={() => {
            clearTimer();
            setIdx(0);
          }}
        >
          {isSale && (
            <div className="absolute left-3 top-3 z-20">
              <span className="rounded bg-error px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-on-error shadow-sm">
                Sale
              </span>
            </div>
          )}
          {types.length > 0 && (
            <div className="absolute right-3 top-3 z-20 group/sizes">
              <Badge
                variant="outline"
                className="cursor-default select-none border-outline-variant/30 bg-surface/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm backdrop-blur-sm"
                aria-label={`Types available: ${types.join(", ")}`}
              >
                Types
              </Badge>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-full z-30 mt-2 max-w-[min(240px,70vw)] opacity-0 transition-opacity duration-200 group-hover/sizes:opacity-100"
              >
                <span className="block rounded-md bg-primary px-3 py-2 text-left text-xs font-medium leading-relaxed text-on-primary shadow-lg">
                  {types.join(" · ")}
                </span>
              </div>
            </div>
          )}

          {imageUrl && !imageUnavailable ? (
            <Image
              key={imageUrl}
              src={imageUrl}
              alt={`${product.name}: image ${idx + 1}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              unoptimized={shouldUnoptimizeImage(imageUrl)}
              priority={priority || idx === 0}
            />
          ) : (
            <div className="absolute inset-0 flex items-end bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high p-4">
              <div className="max-w-[75%] rounded-md bg-white/85 px-3 py-2 text-[11px] font-medium text-on-surface shadow-sm">
                Image unavailable
              </div>
            </div>
          )}

        </div>
        </Link>
        <div className="pointer-events-none absolute inset-x-4 bottom-4 translate-y-2 opacity-0 transition-[transform,opacity] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:group-hover:pointer-events-auto sm:group-focus-within:pointer-events-auto">
          <QuickViewButton slug={product.slug} />
        </div>
      </div>
      <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="mb-1 line-clamp-2 font-headline text-sm font-bold text-primary uppercase">
                {product.name.toUpperCase()}
              </h2>
              <p className="font-body text-xs uppercase tracking-widest text-on-surface-variant">
                {firstVariant?.finish ?? ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {isSale && compareAtPrice ? (
                <span className="block text-xs font-body text-on-surface-variant line-through">
                  PHP {compareAtPrice.toLocaleString("en-PH")}
                </span>
              ) : null}
              <span className={`block font-headline text-base font-medium ${isSale ? "text-error" : "text-primary"}`}>
                PHP {minPrice.toLocaleString("en-PH")}
              </span>
              <BrowsePriceFreshnessCue
                slug={product.slug}
                initialMinPrice={minPrice}
                initialInventorySignature={initialInventorySignature}
              />
              <span className="block text-[9px] text-on-surface-variant uppercase tracking-wider">VAT incl.</span>
            </div>
          </div>
      </CardContent>
      <div className="px-4 pb-4">
        <Link
          href={`/shop/${product.slug}`}
          className="block w-full bg-primary py-3 text-center text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => trackProductClick({ slug: product.slug, id: product.id })}
        >
          View product
        </Link>
      </div>
    </Card>
  );
}
