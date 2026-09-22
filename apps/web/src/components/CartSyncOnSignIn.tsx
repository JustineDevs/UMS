"use client";

import { useSession } from "@/lib/auth-client";
import { useEffect, useRef } from "react";

import { useCart } from "@/context/CartContext";
import {
  getCartMergeKey,
  parseCartMergeResponse,
  readCart,
  writeCart,
} from "@/lib/cart";

/**
 * Merges guest session lines into the Worker customer cart, then links the cookie cart.
 */
export function CartSyncOnSignIn() {
  const { data: session, status } = useSession();
  const { refresh } = useCart();
  const ran = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email || ran.current) {
      return;
    }
    if (window.location.pathname === "/checkout/stripe-return" || window.location.pathname === "/checkout/hosted-return") {
      return;
    }
    ran.current = true;
    void (async () => {
      try {
        const guestLines = readCart();
        if (guestLines.length > 0) {
          const res = await fetch("/api/cart/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mergeKey: getCartMergeKey(),
              guestLines: guestLines.map((l) => ({
                variantId: l.variantId,
                quantity: l.quantity,
              })),
            }),
          });
          if (res.status === 401) {
            // Keep the API unauthenticated response strict, but do not retry a
            // stale client session forever from the shared storefront layout.
            return;
          }
          const data = (await res.json()) as { lines?: unknown };
          const mergedLines = parseCartMergeResponse(res.ok, data.lines);
          if (!mergedLines) {
            throw new Error("Cart merge did not return a complete result");
          }
          // An empty successful result is authoritative: keep the tombstone
          // so stale guest lines cannot reappear during the next hydration.
          writeCart(mergedLines);
          await refresh();
        } else {
          const res = await fetch("/api/cart/attach-customer", { method: "POST" });
          if (res.status === 401) return;
          if (!res.ok) throw new Error("Cart attachment failed");
        }
      } catch {
        ran.current = false;
      }
    })();
  }, [status, session?.user?.email, refresh]);

  return null;
}
