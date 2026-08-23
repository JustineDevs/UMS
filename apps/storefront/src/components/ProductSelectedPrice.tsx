"use client";

import { useProductVariant } from "@/components/ProductVariantProvider";

export function ProductSelectedPrice({ fallback }: { fallback: number }) {
  const { variant } = useProductVariant();
  const price = variant?.price ?? fallback;
  return (
    <p className="text-xl font-body text-on-surface-variant" data-testid="pdp-price">
      {variant ? "" : "From "}PHP {price.toLocaleString("en-PH")}
      <span className="ml-2 text-xs text-on-surface-variant font-normal uppercase tracking-wider">VAT incl.</span>
    </p>
  );
}
