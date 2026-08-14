"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { CartLine } from "@/lib/cart";
import { readCart, writeCart } from "@/lib/cart";

type MedusaCartContextValue = {
  cartId: string | null;
  lines: CartLine[];
  isHydrating: boolean;
  refresh: () => Promise<void>;
  setCartId: (_cartId: string | null) => void;
};

const MedusaCartContext = createContext<MedusaCartContextValue | null>(null);

export function MedusaCartProvider({ children }: { children: React.ReactNode }) {
  const [cartId, setCartId] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);

  const refresh = useCallback(async () => {
    setIsHydrating(true);
    try {
      const res = await fetch("/api/cart/resume");
      const data = (await res.json()) as {
        lines?: CartLine[];
        cartId?: string | null;
      };
      if (Array.isArray(data.lines) && data.lines.length > 0) {
        writeCart(data.lines);
        setLines(data.lines);
        setCartId(typeof data.cartId === "string" ? data.cartId : null);
      } else {
        const local = readCart();
        setLines(local);
        setCartId(null);
      }
    } catch {
      setLines(readCart());
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      cartId,
      lines,
      isHydrating,
      refresh,
      setCartId,
    }),
    [cartId, lines, isHydrating, refresh],
  );

  return (
    <MedusaCartContext.Provider value={value}>
      {children}
    </MedusaCartContext.Provider>
  );
}

export function useMedusaCart(): MedusaCartContextValue {
  const ctx = useContext(MedusaCartContext);
  if (!ctx) {
    throw new Error("useMedusaCart must be used within MedusaCartProvider");
  }
  return ctx;
}
