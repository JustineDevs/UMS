"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import {
  getWishlist,
  type WishlistEntry,
  toggleWishlist,
  clearWishlist,
  updateWishlistMetadata,
  onWishlistChange,
  persistWishlistMutation,
  syncWishlistFromServer,
} from "@/lib/wishlist";
import { addCartLine } from "@/lib/cart";
import { mapWithConcurrency } from "@/lib/async-batching";
import {
  StorefrontActionButton,
  StorefrontCard,
  StorefrontLinkButton,
  StorefrontStatus,
} from "@/components/storefront/StorefrontPagePrimitives";

type AddToBagState = "idle" | "loading" | "done" | "error";

export function WishlistPageClient() {
  const { status } = useSession();
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [sort, setSort] = useState<"date" | "name">("date");
  const addingRef = useRef<Record<string, AddToBagState>>({});
  const [addingStates, setAddingStates] = useState<
    Record<string, AddToBagState>
  >({});
  const enrichmentAttemptedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(() => {
    setItems(getWishlist());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onWishlistChange(refresh);
    return unsub;
  }, [refresh]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    void syncWishlistFromServer()
      .then((serverItems) => {
        if (active) setItems(serverItems);
      })
      .catch(() => {
        // Keep the browser copy visible when the remote list is temporarily unavailable.
      });
    return () => {
      active = false;
    };
  }, [status]);

  useEffect(() => {
    const incomplete = items.filter(
      (item) =>
        (item.imageUrl == null || item.price == null) &&
        !enrichmentAttemptedRef.current.has(item.slug),
    );
    if (!incomplete.length) return;
    let active = true;
    void Promise.all(
      incomplete.map(async (item) => {
        enrichmentAttemptedRef.current.add(item.slug);
        try {
          const response = await fetch(
            `/api/catalog/product-default-variant?slug=${encodeURIComponent(item.slug)}`,
          );
          if (!response.ok) return;
          const metadata = (await response.json()) as {
            imageUrl?: string | null;
            price?: number | null;
            currency?: string;
          };
          if (!active) return;
          updateWishlistMetadata(item.slug, {
            ...(metadata.imageUrl ? { imageUrl: metadata.imageUrl } : {}),
            ...(metadata.price != null ? { price: metadata.price } : {}),
            ...(metadata.currency ? { currencyCode: metadata.currency } : {}),
          });
        } catch {
          // Keep the saved item usable when catalog enrichment is unavailable.
        }
      }),
    ).then(() => {
      if (active) refresh();
    });
    return () => {
      active = false;
    };
  }, [items, refresh]);

  async function remove(slug: string, name: string, medusaProductId?: string) {
    const entry = {
      slug,
      name,
      ...(medusaProductId?.trim()
        ? { medusaProductId: medusaProductId.trim() }
        : {}),
    };
    try {
      await persistWishlistMutation(entry, "remove");
      toggleWishlist(entry);
      refresh();
    } catch {
      setStatusMsg(
        "Saved items could not be synchronized. Nothing was removed.",
      );
    }
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}/wishlist`;
    try {
      const share = (
        navigator as unknown as {
          share?: (
            ..._args: [{ title?: string; url?: string }]
          ) => Promise<void>;
        }
      ).share;
      if (share)
        await share.call(navigator, { title: "My saved items", url: shareUrl });
      else await navigator.clipboard.writeText(shareUrl);
      setStatusMsg(share ? "Wishlist shared." : "Wishlist link copied.");
    } catch {
      setStatusMsg("Sharing was cancelled.");
    }
    setTimeout(() => setStatusMsg(null), 3000);
  }

  async function handleClear() {
    if (!window.confirm("Remove all saved items from your list?")) return;
    const current = getWishlist();
    try {
      await mapWithConcurrency(current, 4, (item) =>
        persistWishlistMutation(item, "remove"),
      );
      clearWishlist();
      refresh();
    } catch {
      setStatusMsg(
        "Saved items could not be synchronized. Nothing was cleared.",
      );
    }
  }

  async function handleAddToBag(item: WishlistEntry) {
    const key = item.medusaProductId ?? item.slug;
    if (addingRef.current[key] === "loading") return;
    addingRef.current[key] = "loading";
    setAddingStates((p) => ({ ...p, [key]: "loading" }));
    try {
      let variantId: string | undefined;
      let variantPrice: number | null = null;
      let variantSku = "";
      let variantCurrency: string | undefined;
      if (item.medusaProductId) {
        const res = await fetch(
          `/api/catalog/product-default-variant?productId=${encodeURIComponent(item.medusaProductId)}`,
        );
        if (res.ok) {
          const json = (await res.json()) as {
            variantId?: string;
            sku?: string;
            price?: number | null;
            currency?: string;
          };
          variantId = json.variantId?.trim() || undefined;
          variantPrice = json.price ?? null;
          variantSku = json.sku ?? "";
          variantCurrency = json.currency?.trim().toUpperCase() || undefined;
        }
      }
      if (!variantId) {
        const res = await fetch(
          `/api/catalog/product-default-variant?slug=${encodeURIComponent(item.slug)}`,
        );
        if (res.ok) {
          const json = (await res.json()) as {
            variantId?: string;
            sku?: string;
            price?: number | null;
            currency?: string;
          };
          variantId = json.variantId?.trim() || undefined;
          variantPrice = json.price ?? null;
          variantSku = json.sku ?? "";
          variantCurrency =
            json.currency?.trim().toUpperCase() || variantCurrency;
        }
      }
      if (!variantId) {
        throw new Error(
          "Could not resolve a variant for this product. View the product page to select options.",
        );
      }
      if (variantPrice == null) {
        throw new Error(
          "The current price is unavailable. View the product page before adding it to your bag.",
        );
      }
      addCartLine({
        variantId,
        quantity: 1,
        price: variantPrice,
        name: item.name,
        slug: item.slug ?? "",
        sku: variantSku,
        type: "",
        finish: "",
        ...(variantCurrency ? { currencyCode: variantCurrency } : {}),
      });
      addingRef.current[key] = "done";
      setAddingStates((p) => ({ ...p, [key]: "done" }));
      setStatusMsg(`"${item.name}" added to bag.`);
      setTimeout(() => setStatusMsg(null), 3000);
      setTimeout(() => {
        addingRef.current[key] = "idle";
        setAddingStates((p) => ({ ...p, [key]: "idle" }));
      }, 2000);
    } catch (e) {
      addingRef.current[key] = "error";
      setAddingStates((p) => ({ ...p, [key]: "error" }));
      setStatusMsg(e instanceof Error ? e.message : "Could not add to bag.");
      setTimeout(() => setStatusMsg(null), 5000);
      setTimeout(() => {
        addingRef.current[key] = "idle";
        setAddingStates((p) => ({ ...p, [key]: "idle" }));
      }, 3000);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-on-surface-variant">Loading…</p>;
  }

  if (status !== "authenticated") {
    return (
      <div className="space-y-4">
        <p className="text-on-surface-variant">
          Sign in to save favorites and keep them with your account on this
          device.
        </p>
        <StorefrontLinkButton
          href={`/login?callbackUrl=${encodeURIComponent("/wishlist")}`}
          variant="primary"
        >
          Sign in to view saved items
        </StorefrontLinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {statusMsg && (
        <p className="text-xs text-emerald-700" role="status">
          {statusMsg}
        </p>
      )}
      {items.length === 0 ? (
        <StorefrontCard className="space-y-4">
          <p className="text-on-surface-variant">
            You have not saved anything yet.{" "}
            <Link href="/shop" className="font-medium text-primary underline">
              Browse the shop
            </Link>{" "}
            and tap the heart on a product to add it here.
          </p>
        </StorefrontCard>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
            <StorefrontStatus>
              {items.length} item{items.length === 1 ? "" : "s"} in your
              wishlist
            </StorefrontStatus>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="wishlist-sort">
                Sort saved items
              </label>
              <select
                id="wishlist-sort"
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as "date" | "name")
                }
                className="h-10 rounded-md border border-outline-variant/30 bg-transparent px-3 text-sm text-primary"
              >
                <option value="date">Recently added</option>
                <option value="name">Name</option>
              </select>
              <StorefrontActionButton
                type="button"
                onClick={() => void handleShare()}
              >
                Share
              </StorefrontActionButton>
            </div>
          </div>
          <StorefrontCard as="div" className="overflow-hidden p-0">
            <ul className="divide-y divide-outline-variant/20">
              {[...items]
                .sort((a, b) =>
                  sort === "name"
                    ? a.name.localeCompare(b.name)
                    : b.addedAt.localeCompare(a.addedAt),
                )
                .map((item) => (
                  <li
                    key={`${item.slug}:${item.medusaProductId ?? ""}`}
                    className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <Link
                        href={`/shop/${item.slug}`}
                        aria-label={`View ${item.name}`}
                        className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-container-low"
                      >
                        {item.imageUrl ? (
                          <div
                            role="img"
                            aria-label={item.name}
                            className="size-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${item.imageUrl})` }}
                          />
                        ) : (
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                            Gear
                          </span>
                        )}
                      </Link>
                      <div className="min-w-0">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                          Saved item
                        </p>
                        <Link
                          href={`/shop/${item.slug}`}
                          className="font-headline font-semibold text-primary hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          {item.price != null
                            ? `${item.currencyCode ?? "PHP"} ${item.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                            : "Price available on product page"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <StorefrontActionButton
                        type="button"
                        onClick={() => void handleAddToBag(item)}
                        disabled={
                          addingStates[item.medusaProductId ?? item.slug] ===
                          "loading"
                        }
                        variant="primary"
                      >
                        {addingStates[item.medusaProductId ?? item.slug] ===
                        "loading"
                          ? "Adding…"
                          : addingStates[item.medusaProductId ?? item.slug] ===
                              "done"
                            ? "Added"
                            : "Add to bag"}
                      </StorefrontActionButton>
                      <StorefrontActionButton
                        type="button"
                        onClick={() =>
                          void remove(
                            item.slug,
                            item.name,
                            item.medusaProductId,
                          )
                        }
                        variant="quiet"
                      >
                        Remove
                      </StorefrontActionButton>
                    </div>
                  </li>
                ))}
            </ul>
            <div className="flex justify-end border-t border-outline-variant/20 p-5 sm:p-7">
              <StorefrontActionButton
                type="button"
                onClick={handleClear}
                variant="quiet"
              >
                Clear all
              </StorefrontActionButton>
            </div>
          </StorefrontCard>
        </>
      )}
    </div>
  );
}
