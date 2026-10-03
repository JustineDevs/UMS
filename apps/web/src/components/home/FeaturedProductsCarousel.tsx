"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@universal-music-store/types";
import {
  Carousel,
  CarouselItem,
  CarouselContent,
  CarouselNext,
  CarouselPrevious,
} from "@universal-music-store/ui";
import { isKnownUnavailableExternalImage, shouldUnoptimizeImage } from "@/lib/image-helpers";

export function FeaturedProductsCarousel({ products }: { products: Product[] }) {
  const featured = products.slice(0, 6);

  if (featured.length === 0) {
    return <div className="h-full w-full bg-surface-container-high" aria-hidden="true" />;
  }

  return (
    <section data-cms-id="home-featured-products" data-cms-label="Featured products carousel" aria-label="Featured products" className="relative flex h-full min-h-[22rem] flex-col overflow-hidden bg-primary text-on-primary">
      <Carousel opts={{ loop: featured.length > 1 }} className="flex min-h-0 flex-1 flex-col">
        <CarouselContent className="ml-0 h-full flex-1">
          {featured.map((product, index) => {
            const imageUrl = product.images.find((image) => image.imageUrl)?.imageUrl;
            const imageUnavailable = imageUrl ? isKnownUnavailableExternalImage(imageUrl) : false;
            const price = Math.min(...product.variants.map((variant) => variant.price));

            return (
              <CarouselItem key={product.id} className="h-full pl-0">
                <Link href={`/shop/${product.slug}`} className="group flex h-full flex-col">
                  <div className="relative min-h-0 flex-1 bg-surface-container-high">
                    {imageUrl && !imageUnavailable ? (
                      <Image src={imageUrl} alt={product.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" unoptimized={shouldUnoptimizeImage(imageUrl)} priority={index === 0} fetchPriority={index === 0 ? "high" : undefined} />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-surface-container-high text-sm text-on-surface-variant">Featured product</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-8">
                    <div className="min-w-0">
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-on-primary/65">Featured product</p>
                      <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{product.name}</h2>
                    </div>
                    <div className="flex shrink-0 items-end gap-3 self-start sm:self-auto">
                      <p className="text-lg font-semibold">PHP {price.toLocaleString("en-PH")}</p>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        {featured.length > 1 ? (
          <>
            <CarouselPrevious className="left-4 border-on-primary/35 bg-primary/80 text-on-primary hover:bg-on-primary hover:text-primary" aria-label="Previous featured product" />
            <CarouselNext className="right-4 border-on-primary/35 bg-primary/80 text-on-primary hover:bg-on-primary hover:text-primary" aria-label="Next featured product" />
          </>
        ) : null}
      </Carousel>
    </section>
  );
}
