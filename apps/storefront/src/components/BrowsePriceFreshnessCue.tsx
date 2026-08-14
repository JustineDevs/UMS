"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  slug: string;
  initialMinPrice: number;
};

/**
 * After tab focus or on an interval, refetches the product and shows a quiet cue when
 * the minimum variant price changed (browse merchandising refresh; PRD matrix).
 */
export function BrowsePriceFreshnessCue({ slug, initialMinPrice }: Props) {
  const [showUpdate, setShowUpdate] = useState(false);
  const lastRef = useRef(initialMinPrice);

  const check = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/shop/product?slug=${encodeURIComponent(slug)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        product?: { variants?: { price: number }[] };
      };
      const variants = data.product?.variants ?? [];
      if (variants.length === 0) return;
      const min = Math.min(...variants.map((v) => v.price));
      if (min !== lastRef.current) {
        lastRef.current = min;
        setShowUpdate(true);
      }
    } catch {
      /* ignore transient fetch errors */
    }
  }, [slug]);

  useEffect(() => {
    lastRef.current = initialMinPrice;
  }, [initialMinPrice]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => {
      void check();
    }, 120_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [check]);

  if (!showUpdate) return null;
  return (
    <span
      className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider text-primary"
      data-testid="browse-price-updated-cue"
    >
      Price updated
    </span>
  );
}
