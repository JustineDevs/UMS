"use client";

import { useCallback, useSyncExternalStore, useState } from "react";
import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  persistWishlistMutation,
  onWishlistChange,
  toggleWishlist,
  wishlistContains,
} from "@/lib/wishlist";
import { useHydrated } from "@/lib/use-hydrated";

type Props = {
  slug: string;
  name: string;
  /** Medusa product id from catalog; optional for legacy call sites. */
  medusaProductId?: string;
  imageUrl?: string;
  price?: number;
  currencyCode?: string;
  className?: string;
  compact?: boolean;
};

export function WishlistToggle({
  slug,
  name,
  medusaProductId,
  imageUrl,
  price,
  currencyCode,
  className = "",
  compact = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const mounted = useHydrated();
  const [pending, setPending] = useState(false);
  const subscribe = useCallback(onWishlistChange, []);
  const getSnapshot = useCallback(
    () => wishlistContains(slug, medusaProductId),
    [slug, medusaProductId],
  );
  const on = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const handleClick = useCallback(async () => {
    if (pending) return;
    if (status !== "authenticated") {
      const next = pathname || `/shop/${slug}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(next)}`);
      return;
    }
    setPending(true);
    const entry = {
      slug,
      name,
      ...(medusaProductId?.trim()
        ? { medusaProductId: medusaProductId.trim() }
        : {}),
      ...(imageUrl?.trim() ? { imageUrl: imageUrl.trim() } : {}),
      ...(typeof price === "number" && Number.isFinite(price) ? { price } : {}),
      ...(currencyCode?.trim()
        ? { currencyCode: currencyCode.trim().toUpperCase() }
        : {}),
    };
    const next = !wishlistContains(slug, medusaProductId);
    try {
      await persistWishlistMutation(entry, next ? "add" : "remove");
      toggleWishlist(entry);
    } catch {
      // Keep the local state unchanged when the server rejects the mutation.
    } finally {
      setPending(false);
    }
  }, [slug, name, medusaProductId, imageUrl, price, currencyCode, status, router, pathname, pending]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={on}
      aria-label={
        on ? "Remove from saved items" : "Save item to your list"
      }
      className={`${compact ? "size-11 rounded-none bg-transparent p-0 hover:bg-transparent" : "rounded bg-surface-container-low p-3 hover:bg-surface-container-high"} inline-flex items-center justify-center transition-colors disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      <Heart
        aria-hidden="true"
        className={`size-[22px] ${on ? "fill-current text-primary" : "text-on-surface-variant"}`}
      />
      {!mounted ? <span className="sr-only">Save</span> : null}
    </button>
  );
}
