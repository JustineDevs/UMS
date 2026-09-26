"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  persistWishlistMutation,
  toggleWishlist,
  wishlistContains,
} from "@/lib/wishlist";

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
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOn(wishlistContains(slug, medusaProductId));
  }, [slug, medusaProductId]);

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
    };
    const next = !wishlistContains(slug, medusaProductId);
    try {
      await persistWishlistMutation(entry, next ? "add" : "remove");
      toggleWishlist(entry);
      setOn(next);
    } catch {
      // Keep the local state unchanged when the server rejects the mutation.
    } finally {
      setPending(false);
    }
  }, [slug, name, medusaProductId, status, router, pathname, pending]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={on}
      aria-label={
        on ? "Remove from saved items" : "Save item to your list"
      }
      className={`inline-flex items-center justify-center rounded bg-surface-container-low p-3 transition-colors hover:bg-surface-container-high disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      <Heart
        aria-hidden="true"
        className={`size-[22px] ${on ? "fill-current text-primary" : "text-on-surface-variant"}`}
      />
      {!mounted ? <span className="sr-only">Save</span> : null}
    </button>
  );
}
