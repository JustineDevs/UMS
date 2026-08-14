"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { PH_VAT_RATE, computeDisplayVat } from "@universal-music-store/sdk";
import type { PosSaleFeatureMetadata } from "@universal-music-store/platform-data";
import {
  buildPosReceiptPayloadFromCart,
  buildProductLabelPayloadFromLineItem,
  fireAndForgetPrint,
  fireAndForgetPrintLabel,
  openCashDrawerRequest,
} from "@/lib/terminal-print";
import { storeOfflineSale, isOnline as checkOnline } from "@/lib/offline-pos";
import { useOfflineSync } from "@/lib/use-offline-sync";
import {
  AdminBreadcrumbs,
  AdminPageHelpFromPath,
  AdminPageShell,
} from "@/components/admin-console";
import { PosSaleDetailsPanel } from "@/components/pos/PosSaleDetailsPanel";

type CartItem = {
  id: string;
  variantId: string;
  name: string;
  size: string;
  color: string;
  sku: string;
  barcode?: string;
  price: number;
  qty: number;
  imageUrl?: string;
};

type VariantLookup = {
  id: string;
  sku: string;
  barcode?: string;
  size: string;
  color: string;
  price: number;
  products: { name?: string } | null;
  imageUrl?: string;
};

type ShiftData = {
  id: string;
  employee_id: string;
  device_name: string;
  opened_at: string;
  status: string;
  opening_cash: number;
};

type PosProductHit = {
  variantId: string;
  name: string;
  sku: string;
  barcode?: string;
  size: string;
  color: string;
  price: number;
  imageUrl?: string;
};

function PosProductImage({
  url,
  alt,
  className,
}: {
  url?: string;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!url?.trim() || broken) {
    return <div className={className} aria-hidden />;
  }
  return (
    <Image
      fill
      src={url}
      alt={alt}
      unoptimized
      sizes="(min-width: 1024px) 240px, 50vw"
      className={className}
      onError={() => setBroken(true)}
    />
  );
}

export default function POSPage() {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hardwareMessage, setHardwareMessage] = useState<string | null>(null);
  const [posFeatures, setPosFeatures] = useState<PosSaleFeatureMetadata>({});

  const { online, pendingCount, syncing, trySync } = useOfflineSync();
  const [activeShift, setActiveShift] = useState<ShiftData | null>(null);
  const [showShiftOpen, setShowShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState({ employee_id: "", opening_cash: "0", device_name: "Terminal 01" });
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidForm, setVoidForm] = useState({ action: "void_item", reason: "", approver_id: "", pin: "" });
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [saleSession, setSaleSession] = useState({ id: "LOCAL", openedAt: new Date(0) });

  useEffect(() => {
    setSaleSession({
      id: Date.now().toString(36).slice(-5).toUpperCase(),
      openedAt: new Date(),
    });
  }, []);

  useEffect(() => {
    fetch("/api/admin/shifts?status=open")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then(({ data }) => {
        if (data?.length > 0) setActiveShift(data[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === "F1") {
        event.preventDefault();
        barcodeInputRef.current?.focus();
      }
      if (event.key === "F2") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: shiftForm.employee_id,
        opening_cash: Number(shiftForm.opening_cash),
        device_name: shiftForm.device_name,
      }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setActiveShift(data);
    }
    setShowShiftOpen(false);
  }

  async function handleCloseShift(e: React.FormEvent) {
    e.preventDefault();
    if (!activeShift) return;
    const res = await fetch(`/api/admin/shifts/${activeShift.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closing_cash: Number(closingCash) }),
    });
    if (res.ok) setActiveShift(null);
    setShowCloseShift(false);
    setClosingCash("");
  }

  async function handleVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!activeShift) {
      setLookupError("Open a shift before recording a void.");
      setShowVoidModal(false);
      return;
    }
    let pinVerified = false;
    if (voidForm.approver_id && voidForm.pin) {
      const pinRes = await fetch("/api/admin/pin-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver_employee_id: voidForm.approver_id, pin: voidForm.pin }),
      });
      if (pinRes.ok) {
        const { approved } = await pinRes.json();
        pinVerified = approved;
      }
      if (!pinVerified) {
        setLookupError("Manager PIN not verified");
        setShowVoidModal(false);
        return;
      }
    }
    const res = await fetch("/api/admin/voids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shift_id: activeShift.id,
        employee_id: activeShift.employee_id,
        approved_by: voidForm.approver_id || undefined,
        action: voidForm.action,
        reason: voidForm.reason,
        pin_verified: pinVerified,
        line_item_id: voidTarget,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setLookupError(
        typeof err.error === "string"
          ? err.error
          : "Void was not recorded.",
      );
      setShowVoidModal(false);
      return;
    }
    if (voidTarget) {
      setCart(cart.filter((c) => c.id !== voidTarget));
    }
    setShowVoidModal(false);
    setVoidForm({ action: "void_item", reason: "", approver_id: "", pin: "" });
    setVoidTarget(null);
    setSuccessMessage("Void recorded successfully.");
  }

  const medusaPosBase = "/api/pos/medusa";

  async function lookupBarcodeOrSku(
    value: string,
  ): Promise<VariantLookup | null> {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isNumeric = /^\d+$/.test(trimmed);
    const body = isNumeric ? { barcode: trimmed } : { sku: trimmed };
    const res = await fetch(`${medusaPosBase}/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }

  const addToCart = useCallback(
    function addToCart(item: Omit<CartItem, "id">) {
      const existing = cart.find((c) => c.variantId === item.variantId);
      if (existing) {
        setCart(
          cart.map((c) => (c === existing ? { ...c, qty: c.qty + 1 } : c)),
        );
      } else {
        setCart([...cart, { ...item, id: crypto.randomUUID() }]);
      }
    },
    [cart],
  );

  async function handleBarcodeSubmit() {
    const value = barcodeInput.trim();
    if (!value) return;
    setLookupError(null);
    const variant = await lookupBarcodeOrSku(value);
    if (variant) {
      const name = (variant.products as { name?: string })?.name ?? "Unknown";
      addToCart({
        variantId: variant.id,
        name,
        size: variant.size,
        color: variant.color,
        sku: variant.sku,
        barcode: variant.barcode,
        price: Number(variant.price),
        qty: 1,
        imageUrl: variant.imageUrl,
      });
      setBarcodeInput("");
    } else {
      setLookupError("No matching variant");
    }
  }

  async function handlePaymentLink() {
    if (cart.length === 0) return;
    setLinkLoading(true);
    setLookupError(null);
    const items = cart.map((c) => ({
      variantId: c.variantId,
      quantity: c.qty,
    }));
    const res = await fetch(`${medusaPosBase}/draft-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, posFeatures }),
    });
    setLinkLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg =
        typeof err.error === "string"
          ? err.error
          : "Unable to create draft order";
      setLookupError(msg);
      return;
    }
    const data = (await res.json()) as {
      draftOrderId?: string;
      displayId?: string | number;
    };
    const ref =
      data.displayId != null ? String(data.displayId) : data.draftOrderId ?? "";
    setSuccessMessage(
      ref
        ? `Draft order created (ref: ${ref}). Complete payment in Admin.`
        : "Draft order created. Complete payment in Admin.",
    );
  }

  async function handleCommitSale() {
    if (cart.length === 0) return;
    const cartSnapshot = cart.map((c) => ({
      name: c.name,
      qty: c.qty,
      price: c.price,
    }));
    const subtotalSnap = subtotal;
    const taxSnap = tax;
    const totalSnap = total;
    setCommitLoading(true);
    setLookupError(null);
    setHardwareMessage(null);

    if (!checkOnline()) {
      await storeOfflineSale({
        id: crypto.randomUUID(),
        device_name: activeShift?.device_name ?? "Terminal 01",
        employee_id: activeShift?.employee_id,
        items: cart.map((c) => ({
          variantId: c.variantId,
          quantity: c.qty,
          price: c.price,
          name: c.name,
        })),
        total,
        created_at: new Date().toISOString(),
        shiftId: activeShift?.id,
        posFeatures,
      });
      setCommitLoading(false);
      setCart([]);
      setPosFeatures({});
      setSuccessMessage("Sale saved offline. Will sync when connection restores.");
      fireAndForgetPrint(
        buildPosReceiptPayloadFromCart(
          cartSnapshot,
          `OFFLINE-${Date.now().toString(36)}`,
          subtotalSnap,
          taxSnap,
          totalSnap,
          true,
        ),
        (m) => setHardwareMessage(m),
      );
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`${medusaPosBase}/commit-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        items: cart.map((c) => ({
          variantId: c.variantId,
          quantity: c.qty,
        })),
        shiftId: activeShift?.id,
        paymentMethod: "cash",
        receiptReference: `pos:${idempotencyKey}`,
        posFeatures,
      }),
    });
    setCommitLoading(false);
    if (res.ok) {
      const { orderNumber } = (await res.json()) as { orderNumber?: string };
      setCart([]);
      setPosFeatures({});
      setLookupError(null);
      setSuccessMessage(
        orderNumber
          ? `Order ${orderNumber} created successfully.`
          : "Order created successfully.",
      );
      fireAndForgetPrint(
        buildPosReceiptPayloadFromCart(
          cartSnapshot,
          orderNumber ? `Order ${orderNumber}` : "Order",
          subtotalSnap,
          taxSnap,
          totalSnap,
          false,
        ),
        (m) => setHardwareMessage(m),
      );
    } else {
      const err = await res.json().catch(() => ({}));
      const errMsg = typeof err.error === "string" ? err.error : "Sale did not complete";
      await storeOfflineSale({
        id: crypto.randomUUID(),
        device_name: activeShift?.device_name ?? "Terminal 01",
        employee_id: activeShift?.employee_id,
        items: cart.map((c) => ({
          variantId: c.variantId,
          quantity: c.qty,
          price: c.price,
          name: c.name,
        })),
        total,
        created_at: new Date().toISOString(),
        shiftId: activeShift?.id,
        posFeatures,
      });
      setCart([]);
      setPosFeatures({});
      setSuccessMessage("Sale queued offline. Automatic retry is enabled.");
      setLookupError(errMsg);
      fireAndForgetPrint(
        buildPosReceiptPayloadFromCart(
          cartSnapshot,
          `OFFLINE-ERR-${Date.now().toString(36)}`,
          subtotalSnap,
          taxSnap,
          totalSnap,
          true,
        ),
        (m) => setHardwareMessage(m),
      );
    }
  }

  async function handleOpenDrawer() {
    setHardwareMessage(null);
    try {
      await openCashDrawerRequest();
    } catch (e) {
      setHardwareMessage(e instanceof Error ? e.message : "Cash drawer did not open");
    }
  }

  function handlePrintLabelForLine(item: CartItem) {
    setHardwareMessage(null);
    fireAndForgetPrintLabel(
      buildProductLabelPayloadFromLineItem({
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        size: item.size,
        color: item.color,
        price: item.price,
      }),
      (m) => setHardwareMessage(m),
    );
  }

  function printLabelFromQuickProduct(p: PosProductHit) {
    setHardwareMessage(null);
    fireAndForgetPrintLabel(
      buildProductLabelPayloadFromLineItem(p),
      (m) => setHardwareMessage(m),
    );
  }

  function removeFromCart(id: string) {
    setCart(cart.filter((c) => c.id !== id));
  }

  function updateQty(id: string, delta: number) {
    setCart(
      cart
        .map((c) => {
          if (c.id !== id) return c;
          const newQty = Math.max(0, c.qty + delta);
          return newQty === 0 ? c : { ...c, qty: newQty };
        })
        .filter((c) => c.qty > 0),
    );
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const tax = computeDisplayVat(subtotal);
  const total = subtotal + tax;

  const [quickProducts, setQuickProducts] = useState<PosProductHit[]>([]);

  const [quickProductsError, setQuickProductsError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<PosProductHit[]>([]);

  const [searchResults, setSearchResults] = useState<PosProductHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${medusaPosBase}/suggestions`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(
        (data: { suggestions?: PosProductHit[] }) => {
          setSuggestions(data.suggestions ?? []);
        },
      )
      .catch(() => {
        setSuggestions([]);
      });
  }, []);

  useEffect(() => {
    const q = searchInput.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q) {
      setSearchResults([]);
      setSearchBusy(false);
      return;
    }
    setSearchBusy(true);
    searchDebounceRef.current = setTimeout(() => {
      void fetch(
        `${medusaPosBase}/search?${new URLSearchParams({ q })}`,
      )
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: { products?: PosProductHit[] }) => {
          setSearchResults(data.products ?? []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchBusy(false));
    }, 320);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    fetch(`${medusaPosBase}/quick-products`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(
        (data: { products?: PosProductHit[] }) => {
          setQuickProducts(data.products ?? []);
          setQuickProductsError(null);
        },
      )
      .catch((err) => {
        setQuickProductsError(
          `Quick products unavailable (${err instanceof Error ? err.message : "no details"})`,
        );
      });
  }, []);

  return (
    <AdminPageShell
      hideHeader
      breadcrumbs={
        <AdminBreadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "POS" }]}
        />
      }
    >
      <div className="flex min-h-0 flex-col gap-8 lg:flex-row">
      <div className="flex-grow space-y-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex flex-wrap items-start gap-2">
                <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
                  {activeShift?.device_name ?? "Terminal 01"}
                </h1>
                <AdminPageHelpFromPath />
              </div>
              <p className="text-on-surface-variant font-body mt-2">
                {activeShift
                  ? `Shift open since ${new Date(activeShift.opened_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`
                  : "No active shift. Open a shift to begin."}
              </p>
            </div>
            <div className="flex gap-2">
              {!activeShift ? (
                <button onClick={() => setShowShiftOpen(true)} className="bg-emerald-600 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">play_arrow</span>
                  Open Shift
                </button>
              ) : (
                <button onClick={() => setShowCloseShift(true)} className="bg-slate-600 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">stop</span>
                  Close Shift
                </button>
              )}
            </div>
          </div>
        </header>

        {successMessage && (
          <div role="status" aria-live="polite" className="bg-emerald-500/10 text-emerald-700 px-4 py-2 rounded text-sm font-medium flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="ml-4 text-emerald-600 hover:text-emerald-800"
            >
              Dismiss
            </button>
          </div>
        )}
        {lookupError && (
          <div className="bg-error/10 text-error px-4 py-2 rounded text-sm font-medium">
            {lookupError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">
              barcode_scanner
            </span>
            <input
              ref={barcodeInputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleBarcodeSubmit();
                }
              }}
              className="w-full bg-surface-container-highest border-none rounded py-4 pl-12 pr-4 focus:ring-1 focus:ring-secondary/40 font-body text-sm transition-all"
              placeholder="Scan Barcode or SKU..."
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-surface-container-low px-2 py-1 rounded text-[10px] font-bold text-on-surface-variant border border-outline-variant/20 uppercase tracking-tighter">
              F1
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">
              search
            </span>
            <input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded py-4 pl-12 pr-4 focus:ring-1 focus:ring-secondary/40 font-body text-sm transition-all"
              placeholder="Search product name..."
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-surface-container-low px-2 py-1 rounded text-[10px] font-bold text-on-surface-variant border border-outline-variant/20 uppercase tracking-tighter">
              F2
            </div>
          </div>
        </div>

        {searchInput.trim() ? (
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Search results
              </h3>
              {searchBusy ? (
                <span className="text-[10px] text-on-surface-variant">Loading</span>
              ) : null}
            </div>
            {searchResults.length === 0 && !searchBusy ? (
              <p className="text-sm text-on-surface-variant">No products match this query.</p>
            ) : (
              <ul className="space-y-1">
                {searchResults.map((p) => (
                  <li key={p.variantId}>
                    <button
                      type="button"
                      onClick={() => {
                        addToCart({
                          variantId: p.variantId,
                          name: p.name,
                          sku: p.sku,
                          barcode: p.barcode,
                          size: p.size,
                          color: p.color,
                          price: p.price,
                          qty: 1,
                          imageUrl: p.imageUrl,
                        });
                        setSearchInput("");
                        setSearchResults([]);
                      }}
                      className="w-full text-left rounded px-3 py-2 hover:bg-surface-container-high transition-colors flex justify-between gap-4"
                    >
                      <span className="text-sm font-medium line-clamp-2">{p.name}</span>
                      <span className="text-xs text-on-surface-variant shrink-0">
                        {p.sku ? `${p.sku} · ` : ""}
                        PHP {p.price.toLocaleString("en-PH")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <PosSaleDetailsPanel value={posFeatures} onChange={setPosFeatures} />

        <section className="mt-12">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6">
            Quick Select / Recent Items
          </h3>
          {quickProductsError && (
            <p className="text-xs text-error mb-4">{quickProductsError}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {quickProducts.map((p) => (
              <div
                key={p.variantId}
                className="relative bg-surface-container-lowest p-4 transition-all hover:bg-surface-container-low"
              >
                <button
                  type="button"
                  onClick={() => printLabelFromQuickProduct(p)}
                  className="absolute right-2 top-2 z-10 rounded bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant hover:bg-surface-dim"
                >
                  Label
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addToCart({
                      variantId: p.variantId,
                      name: p.name,
                      sku: p.sku,
                      barcode: p.barcode,
                      size: p.size,
                      color: p.color,
                      price: p.price,
                      qty: 1,
                      imageUrl: p.imageUrl,
                    })
                  }
                  className="w-full text-left"
                >
                  <div className="relative mb-4 aspect-square w-full overflow-hidden rounded bg-surface-container-high">
                    <PosProductImage
                      url={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-tighter font-headline">
                    {p.name}
                  </p>
                  <p className="text-sm text-on-surface-variant mt-1">
                    PHP {p.price.toLocaleString("en-PH")}
                  </p>
                </button>
              </div>
            ))}
          </div>
        </section>

        {suggestions.length > 0 ? (
          <section className="mt-12">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6">
              Suggested add-ons
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {suggestions.map((p) => (
                <div
                  key={`s-${p.variantId}`}
                  className="relative border border-outline-variant/20 bg-surface-container-lowest p-3 hover:border-primary/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => printLabelFromQuickProduct(p)}
                    className="absolute right-2 top-2 z-10 rounded bg-surface-container-high px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-on-surface-variant hover:bg-surface-dim"
                  >
                    Label
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addToCart({
                        variantId: p.variantId,
                        name: p.name,
                        sku: p.sku,
                        barcode: p.barcode,
                        size: p.size,
                        color: p.color,
                        price: p.price,
                        qty: 1,
                        imageUrl: p.imageUrl,
                      })
                    }
                    className="w-full pr-12 text-left"
                  >
                    <div className="relative mb-2 aspect-[5/4] w-full overflow-hidden rounded bg-surface-container-high">
                      <PosProductImage
                        url={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-tighter font-headline line-clamp-2">
                      {p.name}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      PHP {p.price.toLocaleString("en-PH")}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="w-full lg:w-96 flex flex-col h-[calc(100vh-4rem)] sticky top-8">
        <div className="bg-surface-container-lowest/80 backdrop-blur-xl flex flex-col h-full shadow-[0px_20px_40px_rgba(0,0,0,0.04)] rounded-xl overflow-hidden">
          <div className="p-6 bg-primary text-on-primary">
            <h2 className="text-lg font-bold font-headline tracking-tight">
              Active Sale
            </h2>
            <p className="text-[10px] uppercase tracking-widest text-on-primary/60">
              Session: #{saleSession.id} ·{" "}
              {saleSession.openedAt.getTime() === 0
                ? "--:--"
                : saleSession.openedAt.toLocaleTimeString("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </p>
          </div>
          <div className="flex-grow overflow-y-auto p-6 space-y-6">
            {cart.length === 0 ? (
              <p className="text-on-surface-variant text-sm">
                Cart is empty. Scan or search to add items.
              </p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-surface-container-low">
                    <PosProductImage
                      url={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold font-headline uppercase">
                        {item.name}
                      </h4>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handlePrintLabelForLine(item)}
                          className="text-on-surface-variant hover:text-primary transition-colors"
                          title="Print shelf label to thermal printer"
                        >
                          <span className="material-symbols-outlined text-sm">label</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setVoidTarget(item.id); setShowVoidModal(true); }}
                          className="text-on-surface-variant hover:text-amber-600 transition-colors"
                          title="Record void item"
                        >
                          <span className="material-symbols-outlined text-sm">block</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-on-surface-variant hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="bg-surface-container-low px-2 py-1 rounded text-[10px] font-medium text-on-surface-variant uppercase">
                        Size: {item.size}
                      </span>
                      <span className="bg-surface-container-low px-2 py-1 rounded text-[10px] font-medium text-on-surface-variant uppercase">
                        Color: {item.color}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center bg-surface-container-high rounded hover:bg-surface-dim transition-colors"
                        >
                          <span className="material-symbols-outlined text-xs">
                            remove
                          </span>
                        </button>
                        <span className="text-xs font-bold">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center bg-surface-container-high rounded hover:bg-surface-dim transition-colors"
                        >
                          <span className="material-symbols-outlined text-xs">
                            add
                          </span>
                        </button>
                      </div>
                      <span className="text-sm font-medium">
                        PHP {(item.price * item.qty).toLocaleString("en-PH")}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-6 bg-surface-container-low space-y-2">
            <div className="flex justify-between text-xs text-on-surface-variant font-medium">
              <span>Subtotal</span>
              <span>PHP {subtotal.toLocaleString("en-PH")}</span>
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant font-medium">
              <span>VAT ({(PH_VAT_RATE * 100).toFixed(0)}%)</span>
              <span>PHP {tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-extrabold font-headline mt-2">
              <span>Total</span>
              <span>PHP {total.toFixed(2)}</span>
            </div>
          </div>
          <div className="p-6 space-y-3">
            <button
              type="button"
              disabled={cart.length === 0 || linkLoading}
              onClick={() => void handlePaymentLink()}
              className="w-full py-4 px-6 bg-secondary text-on-secondary font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">link</span>
              {linkLoading ? "Opening checkout…" : "Generate Payment Link"}
            </button>
            <button
              disabled={cart.length === 0 || commitLoading}
              onClick={handleCommitSale}
              className="w-full py-4 px-6 bg-primary text-on-primary font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all shadow-xl shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <span className="material-symbols-outlined text-lg">
                shopping_cart_checkout
              </span>
              {commitLoading ? "Creating..." : "Commit Sale"}
            </button>
            <button
              type="button"
              onClick={() => void handleOpenDrawer()}
              className="w-full py-3 px-6 border border-outline-variant/30 text-on-surface font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-lg">payments</span>
              Open cash drawer
            </button>
            <p className="text-[10px] text-on-surface-variant leading-relaxed px-1">
              Receipts and shelf labels use the print program running on this computer. If printing fails, ask
              whoever maintains your store setup to check the register connection and printer. Barcodes use
              catalog data when available.
            </p>
            {hardwareMessage ? (
              <p role="alert" className="text-xs text-amber-800 px-1">{hardwareMessage}</p>
            ) : null}
          </div>
        </div>
      </div>
      </div>

      <div className="fixed bottom-8 left-72 z-20 flex gap-4">
        <div className="bg-surface-container-highest px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          <span className={`w-2 h-2 rounded-full ${activeShift ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
          {activeShift ? "Shift Active" : "No Shift"}
        </div>
        <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${online ? "bg-surface-container-highest text-on-surface-variant" : "bg-amber-100 text-amber-800"}`}>
          <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
          {online ? "Online" : "Offline Mode"}
        </div>
        {pendingCount > 0 && (
          <button
            onClick={() => void trySync()}
            disabled={syncing}
            className="bg-surface-container-highest px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-dim transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xs">sync</span>
            {syncing ? "Syncing..." : `${pendingCount} pending`}
          </button>
        )}
      </div>

      {showShiftOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleOpenShift} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Open Shift</h2>
            <input required placeholder="Employee ID" value={shiftForm.employee_id} onChange={(e) => setShiftForm({ ...shiftForm, employee_id: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <input required placeholder="Device name" value={shiftForm.device_name} onChange={(e) => setShiftForm({ ...shiftForm, device_name: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <input type="number" step="0.01" placeholder="Opening cash" value={shiftForm.opening_cash} onChange={(e) => setShiftForm({ ...shiftForm, opening_cash: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowShiftOpen(false)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</button>
              <button type="submit" className="bg-primary text-on-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90">Open</button>
            </div>
          </form>
        </div>
      )}

      {showCloseShift && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCloseShift} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Close Shift</h2>
            <p className="text-sm text-on-surface-variant">Opening cash: PHP {activeShift?.opening_cash?.toLocaleString("en-PH")}</p>
            <input required type="number" step="0.01" placeholder="Closing cash amount" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" autoFocus />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCloseShift(false)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</button>
              <button type="submit" className="bg-slate-700 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90">Close Shift</button>
            </div>
          </form>
        </div>
      )}

      {showVoidModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleVoid} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 space-y-5">
            <h2 className="text-lg font-bold font-headline">Void / Override</h2>
            <select disabled value={voidForm.action} onChange={(e) => setVoidForm({ ...voidForm, action: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40 disabled:bg-surface-container-low disabled:text-on-surface-variant">
              <option value="void_item">Void Item</option>
            </select>
            <p className="text-xs text-on-surface-variant">
              This records a cart-line void. Use the Orders workflow for order-level refunds, voids, or discount overrides.
            </p>
            <input required placeholder="Reason" value={voidForm.reason} onChange={(e) => setVoidForm({ ...voidForm, reason: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="border-t border-outline-variant/20 pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Manager Approval</p>
              <input placeholder="Manager Employee ID" value={voidForm.approver_id} onChange={(e) => setVoidForm({ ...voidForm, approver_id: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40 mb-2" />
              <input type="password" placeholder="Manager PIN" value={voidForm.pin} onChange={(e) => setVoidForm({ ...voidForm, pin: e.target.value.replace(/\D/g, "") })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowVoidModal(false); setVoidTarget(null); }} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</button>
              <button type="submit" className="bg-amber-600 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90">Confirm Void</button>
            </div>
          </form>
        </div>
      )}
    </AdminPageShell>
  );
}
