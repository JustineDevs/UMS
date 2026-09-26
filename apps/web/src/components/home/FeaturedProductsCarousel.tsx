"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@universal-music-store/types";
import { isKnownUnavailableExternalImage, shouldUnoptimizeImage } from "@/lib/image-helpers";

export function FeaturedProductsCarousel({ products }: { products: Product[] }) {
  const featured = products.slice(0, 6);
  const [activeIndex, setActiveIndex] = useState(0);

  if (featured.length === 0) {
    return <div className="h-full w-full bg-surface-container-high" aria-hidden="true" />;
  }

  const product = featured[activeIndex % featured.length];
  const imageUrl = product.images.find((image) => image.imageUrl)?.imageUrl;
  const imageUnavailable = imageUrl ? isKnownUnavailableExternalImage(imageUrl) : false;
  const price = Math.min(...product.variants.map((variant) => variant.price));

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + featured.length) % featured.length);
  }

  return (
    <section data-cms-id="home-featured-products" data-cms-label="Featured products carousel" aria-label="Featured products" className="relative h-full min-h-[22rem] overflow-hidden bg-primary text-on-primary">
      <Link href={`/shop/${product.slug}`} className="group flex h-full flex-col">
        <div className="relative min-h-0 flex-1 bg-surface-container-high">
          {imageUrl && !imageUnavailable ? (
            <Image src={imageUrl} alt={product.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" unoptimized={shouldUnoptimizeImage(imageUrl)} priority={activeIndex === 0} />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-container-high text-sm text-on-surface-variant">Featured product</div>
          )}
        </div>
        <div className="flex items-end justify-between gap-4 px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-on-primary/65">Featured product</p>
            <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{product.name}</h2>
          </div>
          <p className="shrink-0 text-lg font-semibold">PHP {price.toLocaleString("en-PH")}</p>
        </div>
      </Link>
      {featured.length > 1 ? (
        <div className="absolute bottom-5 right-6 flex items-center gap-2 sm:right-8" aria-label="Featured product controls">
          <button type="button" onClick={() => move(-1)} className="grid size-9 place-items-center rounded-full border border-on-primary/35 bg-primary/70 text-lg transition-colors hover:bg-on-primary hover:text-primary" aria-label="Previous featured product">←</button>
          <span className="min-w-12 text-center text-xs text-on-primary/75" aria-live="polite">{activeIndex + 1} / {featured.length}</span>
          <button type="button" onClick={() => move(1)} className="grid size-9 place-items-center rounded-full border border-on-primary/35 bg-primary/70 text-lg transition-colors hover:bg-on-primary hover:text-primary" aria-label="Next featured product">→</button>
        </div>
      ) : null}
    </section>
  );
}
