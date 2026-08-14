"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  getWishlist,
  clearWishlist,
  type WishlistEntry,
} from "@/lib/wishlist";

const SYNC_DONE_KEY = "ums_wishlist_synced_v1";

/**
 * Invisible component mounted in the layout that merges localStorage wishlist
 * items into Supabase on first sign-in. The merged server list is then stored
 * back into localStorage so the wishlist UI reflects the combined state.
 *
 * Include once in the authenticated layout:
 *   <WishlistSyncOnLogin />
 */
export function WishlistSyncOnLogin() {
  const { status } = useSession();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (syncedRef.current) return;

    const alreadySynced =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SYNC_DONE_KEY) === "1";
    if (alreadySynced) {
      syncedRef.current = true;
      return;
    }

    syncedRef.current = true;

    const localItems = getWishlist();
    void (async () => {
      try {
        const res = await fetch("/api/wishlist/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: localItems }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          items?: Array<{
            product_slug: string;
            product_name: string;
            medusa_product_id?: string | null;
            added_at: string;
          }>;
        };
        if (json.ok && Array.isArray(json.items)) {
          const merged: WishlistEntry[] = json.items.map((row) => ({
            slug: row.product_slug,
            name: row.product_name,
            ...(row.medusa_product_id ? { medusaProductId: row.medusa_product_id } : {}),
            addedAt: row.added_at,
          }));
          clearWishlist();
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              "universal_music_store_wishlist_v1",
              JSON.stringify(merged),
            );
          }
        }
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(SYNC_DONE_KEY, "1");
        }
      } catch {
        // Non-critical: sync failure should not break anything.
      }
    })();
  }, [status]);

  return null;
}
