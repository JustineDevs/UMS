"use client";

import type { Product, ProductVariant } from "@universal-music-store/types";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ProductVariantContextValue = {
  variant: ProductVariant | undefined;
  selectVariant: (_variantId: string) => void;
  isVariantAvailable: (_variantId: string) => boolean;
};

const ProductVariantContext = createContext<ProductVariantContextValue | null>(null);

export function isVariantSellable(variant: ProductVariant | undefined): boolean {
  if (!variant || !variant.isActive) return false;
  return !variant.manageInventory || variant.inventoryQuantity === null || variant.inventoryQuantity > 0;
}

export function findSellableVariantForOptions(
  product: Product,
  options: { type?: string; finish?: string },
): ProductVariant | undefined {
  return product.variants.find((candidate) =>
    isVariantSellable(candidate) &&
    (options.type === undefined || candidate.type === options.type) &&
    (options.finish === undefined || candidate.finish === options.finish),
  );
}

export function ProductVariantProvider({
  product,
  children,
}: {
  product: Product;
  children: React.ReactNode;
}) {
  const initialVariant = useMemo(
    () => product.variants.find(isVariantSellable) ?? product.variants[0],
    [product.variants],
  );
  const [variantId, setVariantId] = useState(initialVariant?.id ?? "");
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!product.variants.some((variant) => variant.id === variantId)) {
      setVariantId(initialVariant?.id ?? "");
    }
  }, [initialVariant?.id, product.variants, variantId]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/checkout/verify-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: [{ variantId, quantity: 1 }] }),
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
        if (cancelled) return;
        if (!response.ok && response.status !== 200) return;
        setUnavailableIds((current) => {
          const next = new Set(current);
          if (payload?.ok === true) next.delete(variantId);
          else next.add(variantId);
          return next;
        });
      } catch {
        // Keep the server-rendered availability when a transient refresh fails.
      }
    };
    if (variantId) void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [variantId]);

  const variant = product.variants.find((item) => item.id === variantId);
  const value = useMemo(
    () => ({
      variant,
      isVariantAvailable: (id: string) => !unavailableIds.has(id),
      selectVariant: (nextVariantId: string) => {
        if (product.variants.some((item) => item.id === nextVariantId)) {
          setVariantId(nextVariantId);
        }
      },
    }),
    [product.variants, unavailableIds, variant],
  );

  return <ProductVariantContext.Provider value={value}>{children}</ProductVariantContext.Provider>;
}

export function useProductVariant(): ProductVariantContextValue {
  const value = useContext(ProductVariantContext);
  if (!value) throw new Error("useProductVariant must be used inside ProductVariantProvider");
  return value;
}
