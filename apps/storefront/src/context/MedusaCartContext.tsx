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
import {
  CART_STORAGE_KEY,
  CART_UPDATED_EVENT,
  readCart,
  readCartRevision,
  selectHydratedCart,
  writeCart,
} from "@/lib/cart";

type MedusaCartContextValue = {
  cartId: string | null;
  lines: CartLine[];
  hydrationSource:
    | "server"
    | "local-draft"
    | "local-fallback"
    | "empty-server"
    | "unavailable";
  isHydrating: boolean;
  refresh: () => Promise<void>;
  setCartId: (_cartId: string | null) => void;
  replaceLines: (_lines: CartLine[]) => void;
};

const MedusaCartContext = createContext<MedusaCartContextValue | null>(null);

export function MedusaCartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cartId, setCartId] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrationSource, setHydrationSource] =
    useState<MedusaCartContextValue["hydrationSource"]>("unavailable");
  const [isHydrating, setIsHydrating] = useState(true);

  const refresh = useCallback(async () => {
    setIsHydrating(true);
    const hydrationRevision = readCartRevision();
    try {
      const res = await fetch("/api/cart/resume");
      const data = (await res.json()) as {
        lines?: CartLine[];
        cartId?: string | null;
        error?: string;
        skipped?: boolean;
        available?: boolean;
      };
      // Read after the request resolves so an add made during hydration wins
      // over a stale server snapshot returned by the navigation request.
      const localDraft = readCart();
      const localChanged = readCartRevision() !== hydrationRevision;
      if (Array.isArray(data.lines) && data.lines.length > 0) {
        const nextLines = selectHydratedCart(
          localDraft,
          data.lines,
          localChanged,
        );
        if (nextLines !== localDraft) writeCart(nextLines);
        setLines(nextLines);
        setCartId(typeof data.cartId === "string" ? data.cartId : null);
        setHydrationSource(nextLines === localDraft ? "local-draft" : "server");
      } else if (
        !data.cartId ||
        data.available === false ||
        data.error === "unavailable" ||
        data.skipped
      ) {
        setLines(localDraft);
        setCartId(null);
        setHydrationSource(
          localDraft.length > 0 ? "local-fallback" : "unavailable",
        );
      } else if (localDraft.length > 0) {
        // A server cart can be empty or stale while a just-added local draft is navigating.
        setLines(localDraft);
        setCartId(data.cartId);
        setHydrationSource("local-draft");
      } else {
        // A known server cart with no lines is authoritative; do not resurrect stale local lines.
        writeCart([]);
        setLines([]);
        setCartId(data.cartId);
        setHydrationSource("empty-server");
      }
    } catch {
      setLines(readCart());
      setCartId(null);
      setHydrationSource("local-fallback");
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const syncLocalLines = () => setLines(readCart());
    const syncStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY) syncLocalLines();
    };
    window.addEventListener(CART_UPDATED_EVENT, syncLocalLines);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncLocalLines);
      window.removeEventListener("storage", syncStorage);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      cartId,
      lines,
      hydrationSource,
      isHydrating,
      refresh,
      setCartId,
      replaceLines: setLines,
    }),
    [cartId, lines, hydrationSource, isHydrating, refresh],
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
