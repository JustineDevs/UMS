"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readCart,
  mergeReconciledCartLines,
  writeCart,
  updateLineQuantity,
  readCartRevision,
  CART_STORAGE_KEY,
  cartAvailabilityMessage,
  parseCartQuantityInput,
  isCartCheckoutBlocked,
} from "@/lib/cart";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";
import { useMedusaCart } from "@/context/MedusaCartContext";

function formatCartMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString("en-PH")}`;
  }
}

export function CartPageClient() {
  const { cartId, lines, hydrationSource, replaceLines, setCartId } =
    useMedusaCart();
  const [mounted, setMounted] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [authoritativeTotal, setAuthoritativeTotal] = useState<number | null>(
    null,
  );
  const [reconciledAt, setReconciledAt] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState("PHP");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>(
    {},
  );
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>(
    {},
  );
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [quantityStatus, setQuantityStatus] = useState("");
  const reconcileAbortRef = useRef<AbortController | null>(null);
  const reconcileSequenceRef = useRef(0);
  const pendingQuantityRef = useRef<Record<string, number>>({});

  const refresh = useCallback(() => {
    const next = readCart();
    replaceLines(next);
    const localCurrency = next.find((line) => line.currencyCode)?.currencyCode;
    if (localCurrency) setCurrencyCode(localCurrency);
  }, []);

  const reconcile = useCallback(async () => {
    reconcileAbortRef.current?.abort();
    const sequence = ++reconcileSequenceRef.current;
    const current = readCart();
    const startingRevision = readCartRevision();
    if (!current.length) {
      replaceLines([]);
      setAuthoritativeTotal(null);
      setReconciledAt(null);
      setReconcileError(null);
      return;
    }
    setReconciling(true);
    setReconcileError(null);
    const controller = new AbortController();
    reconcileAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch("/api/cart/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          lines: current.map(({ variantId, quantity }) => ({
            variantId,
            quantity,
          })),
        }),
      });
      if (sequence !== reconcileSequenceRef.current) return;
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          lines?: Array<{ variantId?: string; status?: string }>;
        } | null;
        const nextLineErrors: Record<string, string> = {};
        for (const line of payload?.lines ?? []) {
          if (typeof line.variantId === "string" && line.status === "error") {
            nextLineErrors[line.variantId] =
              "This item could not be refreshed. Try again.";
          }
        }
        setLineErrors(nextLineErrors);
        setAuthoritativeTotal(null);
        setReconciledAt(null);
        setReconcileError(
          "Prices and availability could not be refreshed. Refresh before checkout.",
        );
        return refresh();
      }
      const payload = (await response.json()) as {
        lines?: Array<{
          variantId: string;
          quantity?: number;
          slug?: string;
          name?: string;
          sku?: string;
          type?: string;
          finish?: string;
          price?: number;
          thumbnail?: string;
          availableQuantity?: number | null;
          currencyCode?: string;
          status?: string;
        }>;
        cartTotal?: number;
        currency?: string;
        reconciledAt?: string;
      };
      if (sequence !== reconcileSequenceRef.current) return;
      if (readCartRevision() !== startingRevision) {
        refresh();
        return;
      }
      const next = mergeReconciledCartLines(current, payload.lines ?? []);
      setLineErrors({});
      writeCart(next);
      replaceLines(next);
      if (typeof payload.currency === "string" && payload.currency.trim()) {
        setCurrencyCode(payload.currency.trim().toUpperCase());
      }
      setAuthoritativeTotal(
        typeof payload.cartTotal === "number" &&
          Number.isFinite(payload.cartTotal)
          ? payload.cartTotal
          : null,
      );
      setReconciledAt(
        typeof payload.reconciledAt === "string" ? payload.reconciledAt : null,
      );
      setReconcileError(null);
    } catch {
      if (sequence !== reconcileSequenceRef.current) return;
      setAuthoritativeTotal(null);
      setReconciledAt(null);
      setLineErrors({});
      setReconcileError(
        "Prices and availability could not be refreshed. Refresh before checkout.",
      );
      refresh();
    } finally {
      window.clearTimeout(timeout);
      if (sequence === reconcileSequenceRef.current) {
        reconcileAbortRef.current = null;
        setReconciling(false);
      }
    }
  }, [refresh, replaceLines]);

  useEffect(() => {
    setMounted(true);
    void reconcile();
    const onFocus = () => void reconcile();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY) void reconcile();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      reconcileAbortRef.current?.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [reconcile]);

  async function commitQuantity(variantId: string, quantity: number) {
    if (pendingQuantityRef.current[variantId] === quantity) return;
    pendingQuantityRef.current[variantId] = quantity;
    try {
      if (cartId) {
        const response = await fetch("/api/cart/line", {
          method: quantity === 0 ? "DELETE" : "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            variantId,
            ...(quantity > 0 ? { quantity } : {}),
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            code?: string;
          } | null;
          if (payload?.code === "CART_COMPLETED") {
            setCartId(null);
          } else {
            setLineErrors((errors) => ({
              ...errors,
              [variantId]:
                quantity === 0
                  ? "This item could not be removed from the server cart. Try again."
                  : "This quantity could not be saved to the server cart. Try again.",
            }));
            setQuantityStatus(
              quantity === 0
                ? "The item was not removed. Try again."
                : "The quantity was not saved. Try again.",
            );
            return;
          }
        }
      }
      updateLineQuantity(variantId, quantity);
      setQuantityStatus(
        quantity === 0 ? "Item removed from your bag." : "Quantity updated.",
      );
      setAuthoritativeTotal(null);
      setReconciledAt(null);
      setQuantityDrafts((drafts) => {
        const next = { ...drafts };
        delete next[variantId];
        return next;
      });
      setQuantityErrors((errors) => {
        const next = { ...errors };
        delete next[variantId];
        return next;
      });
      refresh();
      void reconcile();
    } catch {
      setLineErrors((errors) => ({
        ...errors,
        [variantId]:
          "The quantity could not be saved. Check your connection and try again.",
      }));
      setQuantityStatus("The quantity was not saved. Try again.");
    } finally {
      if (pendingQuantityRef.current[variantId] === quantity) {
        delete pendingQuantityRef.current[variantId];
      }
    }
  }

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

  const hasStockConflict = lines.some(
    (line) =>
      line.availableQuantity !== null &&
      line.availableQuantity !== undefined &&
      line.quantity > line.availableQuantity,
  );
  const checkoutBlocked = isCartCheckoutBlocked({
    reconciling,
    hasStockConflict,
    reconcileError,
    authoritativeTotal,
  });

  return (
    <div className="space-y-8" data-cart-source={hydrationSource}>
      <p className="sr-only" role="status" aria-live="polite">
        {quantityStatus}
      </p>
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
                  className="flex h-11 w-11 items-center justify-center rounded bg-surface-container-high text-sm hover:opacity-90"
                  onClick={() => {
                    void commitQuantity(l.variantId, l.quantity - 1);
                  }}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={l.availableQuantity ?? undefined}
                  inputMode="numeric"
                  value={quantityDrafts[l.variantId] ?? String(l.quantity)}
                  onFocus={() =>
                    setQuantityDrafts((drafts) => ({
                      ...drafts,
                      [l.variantId]: String(l.quantity),
                    }))
                  }
                  onChange={(event) => {
                    setQuantityDrafts((drafts) => ({
                      ...drafts,
                      [l.variantId]: event.target.value,
                    }));
                    setQuantityErrors((errors) => {
                      const next = { ...errors };
                      delete next[l.variantId];
                      return next;
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    const next = parseCartQuantityInput(
                      event.currentTarget.value,
                    );
                    if (next === null) {
                      setQuantityErrors((errors) => ({
                        ...errors,
                        [l.variantId]: "Enter a whole number, or 0 to remove.",
                      }));
                      return;
                    }
                    void commitQuantity(l.variantId, next);
                  }}
                  className="h-11 w-16 rounded border border-outline-variant/30 bg-surface px-2 text-center text-sm font-bold tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-label={`Quantity for ${l.name}`}
                  aria-invalid={Boolean(quantityErrors[l.variantId])}
                  aria-describedby={
                    quantityErrors[l.variantId]
                      ? `quantity-error-${l.variantId}`
                      : l.availableQuantity !== null &&
                          l.availableQuantity !== undefined
                        ? `quantity-stock-${l.variantId}`
                        : undefined
                  }
                />
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded bg-surface-container-high text-sm hover:opacity-90"
                  onClick={() => {
                    void commitQuantity(l.variantId, l.quantity + 1);
                  }}
                  aria-label="Increase quantity"
                >
                  +
                </button>
                <button
                  type="button"
                  className="ml-1 inline-flex h-11 items-center rounded border border-outline-variant/30 px-3 text-xs font-semibold text-on-surface-variant hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => {
                    void commitQuantity(l.variantId, 0);
                  }}
                  aria-label={`Remove ${l.name} from bag`}
                >
                  Remove
                </button>
              </div>
              {quantityErrors[l.variantId] ? (
                <p
                  id={`quantity-error-${l.variantId}`}
                  className="mt-2 text-xs font-medium text-error"
                  role="alert"
                >
                  {quantityErrors[l.variantId]}
                </p>
              ) : null}
              {l.availableQuantity !== null &&
              l.availableQuantity !== undefined &&
              l.quantity > l.availableQuantity ? (
                <p
                  id={`quantity-stock-${l.variantId}`}
                  className="mt-2 text-xs font-medium text-error"
                  role="alert"
                >
                  {cartAvailabilityMessage(l.availableQuantity)}
                </p>
              ) : null}
              {lineErrors[l.variantId] ? (
                <p className="mt-2 text-xs font-medium text-error" role="alert">
                  {lineErrors[l.variantId]}
                </p>
              ) : null}
            </div>
            <p
              className={`shrink-0 text-sm font-semibold tabular-nums ${
                authoritativeTotal === null
                  ? "text-on-surface-variant"
                  : "text-primary"
              }`}
              data-price-source={
                authoritativeTotal === null
                  ? "local-cache"
                  : "medusa-reconciled"
              }
              aria-label={
                authoritativeTotal === null
                  ? `Estimated price for ${l.name}; refresh before checkout`
                  : `Current price for ${l.name}`
              }
            >
              {formatCartMoney(
                l.price * l.quantity,
                l.currencyCode ?? currencyCode,
              )}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4">
        <div>
          <span className="text-sm font-semibold text-on-surface-variant">
            Cart total
          </span>
          <p
            className="mt-1 text-xs text-on-surface-variant"
            data-testid="cart-total-source"
          >
            {authoritativeTotal === null
              ? "Estimate from your saved bag; refresh before checkout."
              : "Updated from the live catalog; shipping and taxes are calculated at checkout."}
          </p>
          {authoritativeTotal !== null && reconciledAt ? (
            <p
              className="mt-1 text-xs text-on-surface-variant"
              data-testid="cart-last-reconciled"
            >
              Last checked{" "}
              {new Date(reconciledAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
        <span
          className={`text-lg font-bold tabular-nums ${
            authoritativeTotal === null
              ? "text-on-surface-variant"
              : "text-primary"
          }`}
          data-testid="authoritative-cart-total"
          data-total-source={
            authoritativeTotal === null ? "local-cache" : "medusa-reconciled"
          }
          aria-label={
            authoritativeTotal === null
              ? "Estimated cart total; refresh before checkout"
              : "Updated cart total from the live catalog"
          }
        >
          {formatCartMoney(
            authoritativeTotal ??
              lines.reduce(
                (total, line) => total + line.price * line.quantity,
                0,
              ),
            currencyCode,
          )}
        </span>
      </div>
      {reconcileError ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-error">{reconcileError}</p>
          <button
            type="button"
            onClick={() => void reconcile()}
            className="min-h-11 rounded border border-error/40 px-3 py-2 text-xs font-semibold text-error hover:bg-error/5"
          >
            Refresh bag
          </button>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-outline-variant/30 px-6 py-3 text-sm font-semibold text-primary hover:bg-surface-container-low"
        >
          Continue shopping
        </Link>
        {checkoutBlocked ? (
          <button
            type="button"
            disabled
            aria-describedby="cart-checkout-blocked"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary opacity-60"
          >
            {reconciling
              ? "Refreshing prices…"
              : reconcileError
                ? "Refresh before checkout"
                : "Resolve unavailable items"}
          </button>
        ) : (
          <Link
            href="/checkout"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
          >
            Proceed to checkout
          </Link>
        )}
      </div>
      {checkoutBlocked ? (
        <p
          id="cart-checkout-blocked"
          className="sr-only"
          role="status"
          aria-live="polite"
        >
          {reconciling
            ? "Refreshing prices and availability before checkout."
            : reconcileError
              ? "Refresh prices and availability before checkout."
              : "Remove unavailable items or reduce quantities before checkout."}
        </p>
      ) : null}
    </div>
  );
}
