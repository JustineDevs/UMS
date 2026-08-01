"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { toggleWishlist, wishlistContains } from "@/lib/wishlist";

type Props = {
  slug: string;
  name: string;
  /** Medusa product id from catalog; optional for legacy call sites. */
  medusaProductId?: string;
  className?: string;
};

export function WishlistToggle({
  slug,
  name,
  medusaProductId,
  className = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const [on, setOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOn(wishlistContains(slug, medusaProductId));
  }, [slug, medusaProductId]);

  const handleClick = useCallback(() => {
    if (status !== "authenticated") {
      const next = pathname || `/shop/${slug}`;
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(next)}`);
      return;
    }
    const next = toggleWishlist({
      slug,
      name,
      ...(medusaProductId?.trim()
        ? { medusaProductId: medusaProductId.trim() }
        : {}),
    });
    setOn(next);
    posthog.capture("wishlist_item_toggled", {
      product_slug: slug,
      ...(medusaProductId?.trim() ? { product_id: medusaProductId.trim() } : {}),
      saved: next,
    });
  }, [slug, name, medusaProductId, status, router, pathname]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={on}
      aria-label={
        on ? "Remove from saved items" : "Save item to your list"
      }
      className={`inline-flex items-center justify-center rounded border border-outline-variant/40 p-3 transition-colors hover:border-primary ${className}`}
    >
      <span
        className={`material-symbols-outlined text-[22px] ${on ? "text-primary" : "text-on-surface-variant"}`}
        style={on ? { fontVariationSettings: '"FILL" 1' } : undefined}
      >
        favorite
      </span>
      {!mounted ? <span className="sr-only">Save</span> : null}
    </button>
  );
}
