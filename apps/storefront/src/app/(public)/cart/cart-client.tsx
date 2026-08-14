"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  readCart,
  updateLineQuantity,
  type CartLine,
} from "@/lib/cart";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

export function CartPageClient() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setLines(readCart());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  if (!mounted) {
    return (
      <p className="text-sm text-on-surface-variant py-8 text-center">
        Loading your bag…
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="space-y-6 py-8 text-center">
        <p className="text-on-surface-variant text-sm">Your bag is empty.</p>
        <Link
          href="/shop"
          className="inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ul className="space-y-4">
        {lines.map((l) => (
          <li
            key={l.variantId}
            className="flex gap-3 border-b border-outline-variant/20 pb-4"
          >
            {l.thumbnail ? (
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-outline-variant/20 bg-surface-container">
                <Image
                  src={l.thumbnail}
                  alt={l.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={shouldUnoptimizeImage(l.thumbnail)}
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md border border-outline-variant/20 bg-surface-container text-[10px] text-on-surface-variant">
                No img
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Link
                href={`/shop/${l.slug}`}
                className="font-medium text-primary hover:underline"
              >
                {l.name}
              </Link>
              <p className="text-on-surface-variant text-xs mt-0.5">
                {[l.type, l.finish].filter(Boolean).join(" / ") || "Default"}
                {l.sku ? (
                  <span className="text-on-surface-variant/70"> · {l.sku}</span>
                ) : null}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded bg-surface-container-high text-sm hover:opacity-90"
                  onClick={() => {
                    updateLineQuantity(l.variantId, l.quantity - 1);
                    refresh();
                  }}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center text-xs font-bold tabular-nums">
                  {l.quantity}
                </span>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded bg-surface-container-high text-sm hover:opacity-90"
                  onClick={() => {
                    updateLineQuantity(l.variantId, l.quantity + 1);
                    refresh();
                  }}
                  aria-label="Increase quantity"
                >
                  +
                </button>
                <button
                  type="button"
                  className="ml-1 inline-flex h-8 items-center rounded border border-outline-variant/30 px-2.5 text-xs font-semibold text-on-surface-variant hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => {
                    updateLineQuantity(l.variantId, 0);
                    refresh();
                  }}
                  aria-label={`Remove ${l.name} from bag`}
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-primary">
              PHP {(l.price * l.quantity).toLocaleString("en-PH")}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/shop"
          className="inline-flex justify-center rounded-lg border border-outline-variant/30 px-6 py-3 text-sm font-semibold text-primary hover:bg-surface-container-low"
        >
          Continue shopping
        </Link>
        <Link
          href="/checkout"
          className="inline-flex justify-center rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Proceed to checkout
        </Link>
      </div>
    </div>
  );
}
