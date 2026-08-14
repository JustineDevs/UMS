"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import { useMedusaCart } from "@/context/MedusaCartContext";
import { readCart, writeCart, type CartLine } from "@/lib/cart";

/**
 * Merges guest session lines into the Medusa customer cart, then links any cookie cart.
 */
export function CartSyncOnSignIn() {
  const { data: session, status } = useSession();
  const { refresh } = useMedusaCart();
  const ran = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email || ran.current) {
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
              guestLines: guestLines.map((l) => ({
                variantId: l.variantId,
                quantity: l.quantity,
              })),
            }),
          });
          const data = (await res.json()) as { lines?: CartLine[] };
          if (Array.isArray(data.lines) && data.lines.length > 0) {
            writeCart(data.lines);
            await refresh();
          }
        } else {
          await fetch("/api/cart/attach-customer", { method: "POST" });
        }
      } catch {
        ran.current = false;
      }
    })();
  }, [status, session?.user?.email, refresh]);

  return null;
}
