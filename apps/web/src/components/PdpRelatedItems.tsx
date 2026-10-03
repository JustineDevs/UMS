"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@universal-music-store/types";
import { StarRatingDisplay } from "@/components/ReviewStarRatingDisplay";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

type Props = {
  byCategory: Product[];
  byBrand: Product[];
};

function ProductTile({ product }: { product: Product }) {
  const variant = product.variants[0];
  const price = Math.min(...product.variants.map((item) => item.price));
  const image = product.images[0]?.imageUrl;
  const salePrice = product.variants
    .map((item) => item.compareAtPrice)
    .filter((value): value is number => typeof value === "number" && value > price)
    .sort((a, b) => a - b)[0];

  return (
    <article className="min-w-0 border-r border-outline-variant/15 px-4 last:border-r-0">
      <Link href={`/shop/${product.slug}`} className="group block">
        <div className="relative aspect-square overflow-hidden bg-surface-container-low">
          {image ? (
            <Image
              src={image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 16vw"
              className="object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.03]"
              unoptimized={shouldUnoptimizeImage(image)}
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-on-surface-variant">Image unavailable</div>
          )}
          {salePrice ? (
            <span className="absolute left-2 top-2 rounded bg-error px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-error">
              Save PHP {(salePrice - price).toLocaleString("en-PH")}
            </span>
          ) : null}
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {product.brand || product.category || "Universal Music Store"}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-primary">
          {product.name}
        </h3>
        <div className="mt-2 flex min-h-5 items-center gap-2 text-xs">
          <StarRatingDisplay value={0} size="sm" />
          <span className="text-on-surface-variant">No reviews</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-headline text-lg font-bold text-primary">
            PHP {price.toLocaleString("en-PH")}
          </span>
          {salePrice ? (
            <span className="text-xs text-on-surface-variant line-through">PHP {salePrice.toLocaleString("en-PH")}</span>
          ) : null}
        </div>
        <span className="mt-4 block rounded bg-primary px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity group-hover:opacity-85">
          View product
        </span>
      </Link>
      <span className="sr-only">{variant?.sku ? `SKU ${variant.sku}` : ""}</span>
    </article>
  );
}

export function PdpRelatedItems({ byCategory, byBrand }: Props) {
  const [mode, setMode] = useState<"category" | "brand">("category");
  const products = mode === "category" ? byCategory : byBrand;

  return (
    <section className="border-t border-outline-variant/20 pt-12" aria-labelledby="related-heading">
      <h2 id="related-heading" className="text-center font-headline text-2xl font-bold text-primary">
        Related items
      </h2>
      <div className="mt-6 flex gap-6 border-b border-outline-variant/20" role="tablist" aria-label="Related item filters">
        {(["category", "brand"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
            className={`border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
              mode === item ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            By {item === "category" ? "category" : "brand"}
          </button>
        ))}
      </div>
      {products.length ? (
        <div className="mt-8 grid grid-cols-2 gap-y-10 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => <ProductTile key={product.id} product={product} />)}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-on-surface-variant">No related items found.</p>
      )}
    </section>
  );
}
