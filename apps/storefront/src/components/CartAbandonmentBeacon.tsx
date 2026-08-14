"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { readCart } from "@/lib/cart";

/**
 * Sends a best-effort event when the visitor leaves the tab with items still in the cart.
 * The server handler for POST /api/cart/abandonment must be configured with secrets (not in the client bundle).
 */
export function CartAbandonmentBeacon() {
  const sentRef = useRef(false);
  const { data: session } = useSession();

  useEffect(() => {
    function payload() {
      const lines = readCart();
      if (lines.length === 0) return null;
      const accountEmail = session?.user?.email?.trim() ?? null;
      return JSON.stringify({
        lines: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          price: l.price,
        })),
        email: accountEmail,
        path: typeof window !== "undefined" ? window.location.pathname : "",
        referrer:
          typeof document !== "undefined" ? document.referrer || null : null,
        clientTimestamp: new Date().toISOString(),
      });
    }

    function send() {
      if (sentRef.current) return;
      const body = payload();
      if (!body) return;
      sentRef.current = true;
      void fetch("/api/cart/abandonment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        sentRef.current = false;
      });
    }

    function onHidden() {
      if (document.visibilityState === "hidden") send();
    }

    function onPageHide() {
      send();
    }

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [session?.user?.email]);

  return null;
}
