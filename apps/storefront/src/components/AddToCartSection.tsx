"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@universal-music-store/types";
import { addCartLine, type CartLine } from "@/lib/cart";
import { WishlistToggle } from "@/components/WishlistToggle";
import { BackInStockNotify } from "@/components/BackInStockNotify";
import { trackAddToCart } from "@/lib/analytics";

export function AddToCartSection({
  product,
  testId = "pdp-add-to-bag",
}: {
  product: Product;
  testId?: string;
}) {
  const router = useRouter();
  const types = useMemo(
    () => [...new Set(product.variants.map((v) => v.type))].sort(),
    [product.variants],
  );
  const finishes = useMemo(
    () => [...new Set(product.variants.map((v) => v.finish))].sort(),
    [product.variants],
  );
  const defaultPair = useMemo(() => {
    const v0 = product.variants[0];
    return { type: v0?.type ?? "", finish: v0?.finish ?? "" };
  }, [product.variants]);
  const [type, setType] = useState(defaultPair.type);
  const [finish, setFinish] = useState(defaultPair.finish);

  useEffect(() => {
    setType(defaultPair.type);
    setFinish(defaultPair.finish);
  }, [product.slug, defaultPair.type, defaultPair.finish]);

  const variant = useMemo(
    () => product.variants.find((v) => v.type === type && v.finish === finish),
    [product.variants, type, finish],
  );

  const LOW_STOCK_THRESHOLD = 5;
  const stockQty =
    variant?.manageInventory && typeof variant.inventoryQuantity === "number"
      ? variant.inventoryQuantity
      : null;
  const isLowStock = stockQty !== null && stockQty > 0 && stockQty <= LOW_STOCK_THRESHOLD;
  const isOutOfStock = variant !== undefined && !variant.isActive;
  const allVariantsOos = product.variants.length > 0 && product.variants.every((v) => !v.isActive);

  function handleAddToBag() {
    if (!variant) return;
    const thumb = product.images?.[0]?.imageUrl ?? undefined;
    const line: CartLine = {
      variantId: variant.id,
      quantity: 1,
      slug: product.slug,
      name: product.name,
      sku: variant.sku,
      type: variant.type,
      finish: variant.finish,
      price: variant.price,
      ...(thumb ? { thumbnail: thumb } : {}),
    };
    addCartLine(line);
    trackAddToCart({
      slug: product.slug,
      id: product.id,
      variantId: variant.id,
      price: variant.price,
      quantity: 1,
      name: product.name,
    });
    router.push("/cart");
  }

  if (allVariantsOos) {
    return (
      <div className="space-y-6">
        <p className="text-sm font-medium text-on-surface-variant">
          This product is currently out of stock.
        </p>
        <BackInStockNotify
          productId={product.id}
          productSlug={product.slug}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <p className="text-xs font-label font-bold uppercase tracking-wider">
            Type
          </p>
          <span className="text-xs font-label text-secondary">Select one</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-3 text-sm font-medium transition-all ${
                type === t
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low hover:bg-surface-container-high"
              }`}
              aria-pressed={type === t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <p className="text-xs font-label font-bold uppercase tracking-wider">
            Finish
          </p>
          <span className="text-xs font-label text-secondary">Select one</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {finishes.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFinish(f)}
              className={`py-3 text-sm font-medium transition-all ${
                finish === f
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low hover:bg-surface-container-high"
              }`}
              aria-pressed={finish === f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLowStock && stockQty !== null && (
        <p className="text-sm font-medium text-error" role="alert">
          Only {stockQty} left in stock
        </p>
      )}
      {isOutOfStock && (
        <p className="text-sm font-medium text-on-surface-variant" role="alert">
          Out of stock
        </p>
      )}

      <div className="flex flex-col gap-3 pt-4 min-[400px]:flex-row min-[400px]:items-stretch">
        <WishlistToggle
          slug={product.slug}
          name={product.name}
          medusaProductId={product.id}
          className="min-[400px]:shrink-0"
        />
        <button
          type="button"
          data-testid={testId}
          disabled={!variant || isOutOfStock}
          onClick={handleAddToBag}
          className="min-h-[52px] flex-1 py-4 px-4 bg-primary text-on-primary font-headline font-bold tracking-tight rounded text-center hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isOutOfStock
            ? "Out of stock"
            : "Add to bag and checkout"}
        </button>
      </div>
    </div>
  );
}
