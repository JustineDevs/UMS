"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Product } from "@universal-music-store/types";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@universal-music-store/ui";
import { AddToCartSection } from "@/components/AddToCartSection";
import { minVariantPrice } from "@/lib/medusa-catalog-mapper";
import {
  isKnownUnavailableExternalImage,
  shouldUnoptimizeImage,
} from "@/lib/image-helpers";

export function ProductQuickViewModal({
  slug,
  open,
  onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/shop/product?slug=${encodeURIComponent(slug)}`,
        );
        const data = (await res.json()) as {
          product?: Product;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Unable to load");
          return;
        }
        if (data.product) setProduct(data.product);
      } catch {
        if (!cancelled) setError("Network error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, open]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setProduct(null);
    }
  }, [open]);

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    if (!open) {
      return;
    }

    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
    };
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,72rem)] overflow-hidden border-outline-variant/20 p-0">
        <DialogHeader className="border-b border-outline-variant/10 px-6 py-5 text-left">
          <DialogTitle className="font-headline text-xl font-bold uppercase tracking-wide text-primary">
            {product?.name ?? "Loading…"}
          </DialogTitle>
          <DialogDescription className="text-sm text-on-surface-variant">
            Quick look at price, imagery, and add-to-cart actions without leaving the catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-6 py-6">
          {error ? (
            <div className="rounded-lg border border-error/20 bg-error/5 p-4 text-sm text-error">
              {error}
            </div>
          ) : product ? (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-3">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface-container-low">
                  {product.images[0]?.imageUrl &&
                  !isKnownUnavailableExternalImage(product.images[0].imageUrl) ? (
                    <Image
                      src={product.images[0].imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      unoptimized={shouldUnoptimizeImage(product.images[0].imageUrl)}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high p-4 text-center text-sm text-on-surface-variant">
                      Image unavailable
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.brand ? (
                    <Badge variant="outline" className="border-outline-variant/30 bg-surface/80">
                      {product.brand}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="border-outline-variant/30 bg-surface/80">
                    Quick view
                  </Badge>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
                    Starting at
                  </p>
                  <p className="font-headline text-3xl font-bold text-primary">
                    PHP {minVariantPrice(product).toLocaleString("en-PH")}
                  </p>
                </div>

                <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/60 p-4">
                  <p className="text-sm font-medium text-on-surface-variant">
                    Add the current instrument directly to cart from the modal, then continue browsing.
                  </p>
                </div>

                <AddToCartSection product={product} testId="quick-view-add-to-bag" />

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                  >
                    Close modal
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Loading product…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
