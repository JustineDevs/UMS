"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ShopQuery } from "@/lib/shop-url";
import { shopHref } from "@/lib/shop-url";

type Props = {
  category?: string;
  type?: string;
  finish?: string;
  brand?: string;
  pickupConfig?: string;
  bodyWood?: string;
  condition?: string;
  skillLevel?: string;
  shippingSpeed?: string;
  sort: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
};

export function ShopPriceRangeForm({
  category,
  type,
  finish,
  brand,
  pickupConfig,
  bodyWood,
  condition,
  skillLevel,
  shippingSpeed,
  sort,
  search,
  minPrice,
  maxPrice,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [min, setMin] = useState(
    minPrice != null ? String(minPrice) : "",
  );
  const [max, setMax] = useState(
    maxPrice != null ? String(maxPrice) : "",
  );

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const base: ShopQuery = {
      category,
      type,
      finish,
      brand,
      pickupConfig,
      bodyWood,
      condition,
      skillLevel,
      shippingSpeed,
      sort,
      search,
    };
    const nMin = min.trim() === "" ? undefined : Number(min);
    const nMax = max.trim() === "" ? undefined : Number(max);
    base.minPrice =
      nMin != null && Number.isFinite(nMin) && nMin >= 0 ? nMin : undefined;
    base.maxPrice =
      nMax != null && Number.isFinite(nMax) && nMax >= 0 ? nMax : undefined;
    startTransition(() => {
      router.push(shopHref(base));
    });
  }

  return (
    <form onSubmit={(ev) => void apply(ev)} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Min PHP
          </span>
          <input
            type="number"
            name="minPrice"
            min={0}
            step={1}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="w-full rounded border border-outline-variant/30 bg-white px-2 py-2 text-xs text-on-surface"
            disabled={pending}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Max PHP
          </span>
          <input
            type="number"
            name="maxPrice"
            min={0}
            step={1}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="w-full rounded border border-outline-variant/30 bg-white px-2 py-2 text-xs text-on-surface"
            disabled={pending}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-primary py-2 text-[10px] font-bold uppercase tracking-widest text-on-primary hover:opacity-95 disabled:opacity-50"
      >
        Apply price
      </button>
    </form>
  );
}
