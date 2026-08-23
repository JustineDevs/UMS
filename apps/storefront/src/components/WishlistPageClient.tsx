"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  getWishlist,
  type WishlistEntry,
  toggleWishlist,
  clearWishlist,
  exportWishlistJSON,
  importWishlistJSON,
  onWishlistChange,
  persistWishlistMutation,
} from "@/lib/wishlist";
import { addCartLine } from "@/lib/cart";

type AddToBagState = "idle" | "loading" | "done" | "error";

export function WishlistPageClient() {
  const { status } = useSession();
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const addingRef = useRef<Record<string, AddToBagState>>({});
  const [addingStates, setAddingStates] = useState<Record<string, AddToBagState>>({});

  const refresh = useCallback(() => {
    setItems(getWishlist());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onWishlistChange(refresh);
    return unsub;
  }, [refresh]);

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
      setStatusMsg("Saved items could not be synchronized. Nothing was removed.");
    }
  }

  function handleExport() {
    const json = exportWishlistJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "saved-items-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRestoreFromBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const count = importWishlistJSON(reader.result as string);
          refresh();
          setStatusMsg(
            `Restored ${count} new item${count !== 1 ? "s" : ""} to your saved list.`,
          );
          setTimeout(() => setStatusMsg(null), 4000);
        } catch {
          setStatusMsg(
            "That file could not be read. Use a backup you exported from this shop.",
          );
          setTimeout(() => setStatusMsg(null), 4000);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  async function handleClear() {
    const current = getWishlist();
    try {
      await Promise.all(current.map((item) => persistWishlistMutation(item, "remove")));
      clearWishlist();
      refresh();
    } catch {
      setStatusMsg("Saved items could not be synchronized. Nothing was cleared.");
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
          const json = (await res.json()) as { variantId?: string; sku?: string; price?: number | null; currency?: string };
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
          const json = (await res.json()) as { variantId?: string; sku?: string; price?: number | null; currency?: string };
          variantId = json.variantId?.trim() || undefined;
          variantPrice = json.price ?? null;
          variantSku = json.sku ?? "";
          variantCurrency = json.currency?.trim().toUpperCase() || variantCurrency;
        }
      }
      if (!variantId) {
        throw new Error("Could not resolve a variant for this product. View the product page to select options.");
      }
      if (variantPrice == null) {
        throw new Error("The current price is unavailable. View the product page before adding it to your bag.");
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
          Sign in to save favorites and keep them with your account on this device.
        </p>
        <Link
          href={`/sign-in?callbackUrl=${encodeURIComponent("/wishlist")}`}
          className="inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Sign in to view saved items
        </Link>
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
        <div className="space-y-4">
          <p className="text-on-surface-variant">
            You have not saved anything yet.{" "}
            <Link href="/shop" className="font-medium text-primary underline">
              Browse the shop
            </Link>{" "}
            and tap the heart on a product to add it here.
          </p>
          <p className="text-xs text-on-surface-variant">
            Already have a backup from this shop? You can merge those items into this list.
          </p>
          <button
            type="button"
            onClick={handleRestoreFromBackup}
            className="rounded border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-on-primary"
          >
            Restore from backup file
          </button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-outline-variant/20 rounded-lg border border-outline-variant/20">
            {items.map((item) => (
              <li
                key={`${item.slug}:${item.medusaProductId ?? ""}`}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/shop/${item.slug}`}
                    className="font-headline font-semibold text-primary hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-on-surface-variant">
                    /{item.slug}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleAddToBag(item)}
                    disabled={addingStates[item.medusaProductId ?? item.slug] === "loading"}
                    className="rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-primary hover:opacity-90 disabled:opacity-50"
                  >
                    {addingStates[item.medusaProductId ?? item.slug] === "loading"
                      ? "Adding…"
                      : addingStates[item.medusaProductId ?? item.slug] === "done"
                        ? "Added"
                        : "Add to bag"}
                  </button>
                  <Link
                    href={`/shop/${item.slug}`}
                    className="rounded border border-primary px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-on-primary"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      void remove(item.slug, item.name, item.medusaProductId)
                    }
                    className="rounded border border-outline-variant px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:border-error hover:text-error"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="rounded border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-on-primary"
            >
              Download backup
            </button>
            <button
              type="button"
              onClick={handleRestoreFromBackup}
              className="rounded border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-on-primary"
            >
              Restore from backup
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded border border-outline-variant px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:border-error hover:text-error"
            >
              Clear all
            </button>
          </div>
        </>
      )}
    </div>
  );
}
