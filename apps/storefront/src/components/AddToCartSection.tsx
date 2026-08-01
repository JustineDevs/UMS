"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import type { Product } from "@apparel-commerce/types";
import { addCartLine, type CartLine } from "@/lib/cart";
import { WishlistToggle } from "@/components/WishlistToggle";
import {
  cssColorForVariantColorLabel,
  swatchNeedsLightStroke,
} from "@/lib/variant-color-swatch";

export function AddToCartSection({ product }: { product: Product }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const sizes = useMemo(
    () => [...new Set(product.variants.map((v) => v.size))].sort(),
    [product.variants],
  );
  const colors = useMemo(
    () => [...new Set(product.variants.map((v) => v.color))],
    [product.variants],
  );
  const defaultPair = useMemo(() => {
    const v0 = product.variants[0];
    return { size: v0?.size ?? "", color: v0?.color ?? "" };
  }, [product.variants]);
  const [size, setSize] = useState(defaultPair.size);
  const [color, setColor] = useState(defaultPair.color);

  useEffect(() => {
    setSize(defaultPair.size);
    setColor(defaultPair.color);
  }, [product.slug, defaultPair.size, defaultPair.color]);

  const variant = useMemo(
    () => product.variants.find((v) => v.size === size && v.color === color),
    [product.variants, size, color],
  );

  function handleAddToBag() {
    if (!variant) return;
    if (status !== "authenticated") {
      const next = pathname || `/shop/${product.slug}`;
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(next)}`);
      return;
    }
    const line: CartLine = {
      variantId: variant.id,
      quantity: 1,
      slug: product.slug,
      name: product.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      price: variant.price,
    };
    addCartLine(line);
    posthog.capture("product_added_to_cart", {
      product_id: product.id,
      variant_id: variant.id,
      product_slug: product.slug,
      quantity: line.quantity,
    });
    router.push("/checkout");
  }

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <p className="text-xs font-label font-bold uppercase tracking-wider">
          Color:{" "}
          <span className="text-secondary font-normal">{color || "None"}</span>
        </p>
        <div className="flex flex-wrap gap-3">
          {colors.map((c) => {
            const fill = cssColorForVariantColorLabel(c);
            const light = swatchNeedsLightStroke(fill);
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: fill }}
                className={`w-10 h-10 rounded-full transition-all ${
                  color === c
                    ? "ring-2 ring-primary scale-105"
                    : light
                      ? "ring-1 ring-outline-variant hover:ring-primary"
                      : "ring-1 ring-black/20 hover:ring-primary"
                }`}
                title={c}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <p className="text-xs font-label font-bold uppercase tracking-wider">
            Size
          </p>
          <span className="text-xs font-label text-secondary">Select one</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`py-3 text-sm font-medium transition-all ${
                size === s
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low hover:bg-surface-container-high"
              }`}
              aria-pressed={size === s}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-4 min-[400px]:flex-row min-[400px]:items-stretch">
        <WishlistToggle
          slug={product.slug}
          name={product.name}
          medusaProductId={product.id}
          className="min-[400px]:shrink-0"
        />
        <button
          type="button"
          data-testid="pdp-add-to-bag"
          disabled={!variant || status === "loading"}
          onClick={handleAddToBag}
          className="min-h-[52px] flex-1 py-4 px-4 bg-primary text-on-primary font-headline font-bold tracking-tight rounded text-center hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {status === "authenticated"
            ? "Add to bag and checkout"
            : status === "loading"
              ? "Loading…"
              : "Sign in to add to bag"}
        </button>
      </div>
    </div>
  );
}
