"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  getWishlist,
  clearWishlist,
  wishlistSyncStorageKey,
  type WishlistEntry,
} from "@/lib/wishlist";

/**
 * Invisible component mounted in the layout that merges localStorage wishlist
 * items into Supabase on first sign-in. The merged server list is then stored
 * back into localStorage so the wishlist UI reflects the combined state.
 *
 * Include once in the authenticated layout:
 *   <WishlistSyncOnLogin />
 */
export function WishlistSyncOnLogin() {
  const { data: session, status } = useSession();
  const syncedRef = useRef(false);
  const identityRef = useRef<string | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "partial" | "error">("idle");
  const identity =
    session?.user?.email?.trim().toLowerCase() ||
    session?.user?.id?.trim() ||
    null;

  const sync = useCallback(async () => {
    setSyncState("syncing");
    const localItems = getWishlist();
    try {
      const res = await fetch("/api/wishlist/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: localItems
            .filter((item) => item.medusaProductId?.trim())
            .map((item) => ({ medusaProductId: item.medusaProductId!.trim() })),
        }),
      });
      if (!res.ok) throw new Error("wishlist_sync_failed");
      const json = (await res.json()) as {
        ok?: boolean;
        items?: Array<{
          product_slug: string;
          product_name: string;
          medusa_product_id?: string | null;
          added_at: string;
        }>;
        skippedProductIds?: string[];
      };
      if (!json.ok || !Array.isArray(json.items)) throw new Error("wishlist_sync_invalid");
      const merged: WishlistEntry[] = json.items.map((row) => ({
        slug: row.product_slug,
        name: row.product_name,
        ...(row.medusa_product_id ? { medusaProductId: row.medusa_product_id } : {}),
        addedAt: row.added_at,
      }));
      const skipped = new Set((json.skippedProductIds ?? []).map((id) => id.trim()).filter(Boolean));
      clearWishlist();
      window.localStorage.setItem(
        "universal_music_store_wishlist_v1",
        JSON.stringify(merged),
      );
      if (identity) window.sessionStorage.setItem(wishlistSyncStorageKey(identity), "1");
      syncedRef.current = true;
      setSyncState(skipped.size > 0 ? "partial" : "idle");
    } catch {
      syncedRef.current = false;
      setSyncState("error");
    }
  }, [identity]);

  useEffect(() => {
    if (status !== "authenticated" || !identity) return;
    if (identityRef.current !== identity) {
      identityRef.current = identity;
      syncedRef.current = false;
    }
    if (syncedRef.current) return;

    const alreadySynced =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(wishlistSyncStorageKey(identity)) === "1";
    if (alreadySynced) {
      syncedRef.current = true;
      return;
    }

    void sync();
  }, [identity, status, sync]);

  if (status !== "authenticated" || !["error", "partial"].includes(syncState)) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-4 rounded-xl border border-error/30 bg-surface-container-lowest p-4 text-sm shadow-lg" role="alert">
      <span>
        {syncState === "partial"
          ? "Some saved items are no longer available and were kept locally for review."
          : "Saved items could not be synchronized. Your local list is unchanged."}
      </span>
      <button type="button" onClick={() => void sync()} className="min-h-11 shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary">
        Retry
      </button>
    </div>
  );
}
