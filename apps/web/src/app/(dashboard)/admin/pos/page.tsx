"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Barcode, Ban, CreditCard, Link2, Minus, PackageCheck, Play, Plus, RefreshCw, Search, Square, Tag, X } from "lucide-react";
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
import { useHydrated } from "@/lib/use-hydrated";
import {
  AdminBreadcrumbs,
  AdminPageHelpFromPath,
  AdminPageShell,
} from "@/components/admin-console";
import { PosSaleDetailsPanel } from "@/components/pos/PosSaleDetailsPanel";
import { Button } from "@universal-music-store/ui";

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

function ModalPortal({ children }: { children: React.ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

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

function formatHardwareError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return /failed to fetch|networkerror|load failed/i.test(message)
    ? fallback
    : message || "Hardware command did not complete";
}

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
  const voidTargetRef = useRef<string | null>(null);
  const shiftOpenBusyRef = useRef(false);
  const shiftCloseBusyRef = useRef(false);
  const voidBusyRef = useRef(false);
  const barcodeBusyRef = useRef(false);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const hydrated = useHydrated();
  const saleSession = useMemo(
    () => hydrated
      ? { id: Date.now().toString(36).slice(-5).toUpperCase(), openedAt: new Date() }
      : { id: "LOCAL", openedAt: new Date(0) },
    [hydrated],
  );

  useEffect(() => {
    if (!showShiftOpen && !showCloseShift && !showVoidModal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showVoidModal) {
        setShowVoidModal(false);
        voidTargetRef.current = null;
      } else if (showCloseShift) {
        setShowCloseShift(false);
      } else {
        setShowShiftOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showCloseShift, showShiftOpen, showVoidModal]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/shifts?status=open", { signal: controller.signal })
      .then((r) => r.ok ? r.json() : { data: [] })
      .then(({ data }) => {
        if (data?.length > 0) setActiveShift(data[0]);
      })
      .catch(() => {});
    return () => controller.abort();
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
    if (shiftOpenBusyRef.current) return;
    shiftOpenBusyRef.current = true;
    try {
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
    } finally {
      shiftOpenBusyRef.current = false;
      setShowShiftOpen(false);
    }
  }

  async function handleCloseShift(e: React.FormEvent) {
    e.preventDefault();
    if (!activeShift || shiftCloseBusyRef.current) return;
    shiftCloseBusyRef.current = true;
    try {
      const res = await fetch(`/api/admin/shifts/${activeShift.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closing_cash: Number(closingCash) }),
      });
      if (res.ok) setActiveShift(null);
    } finally {
      shiftCloseBusyRef.current = false;
      setShowCloseShift(false);
      setClosingCash("");
    }
  }

  async function handleVoid(e: React.FormEvent) {
    e.preventDefault();
    if (voidBusyRef.current) return;
    voidBusyRef.current = true;
    try {
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
        line_item_id: voidTargetRef.current,
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
    if (voidTargetRef.current) {
      setCart(cart.filter((c) => c.id !== voidTargetRef.current));
    }
    setShowVoidModal(false);
    setVoidForm({ action: "void_item", reason: "", approver_id: "", pin: "" });
    voidTargetRef.current = null;
    setSuccessMessage("Void recorded successfully.");
    } finally {
      voidBusyRef.current = false;
    }
  }

  const posCommerceApiBase = "/api/pos/commerce";

  async function lookupBarcodeOrSku(
    value: string,
  ): Promise<VariantLookup | null> {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isNumeric = /^\d+$/.test(trimmed);
    const body = isNumeric ? { barcode: trimmed } : { sku: trimmed };
    const res = await fetch(`${posCommerceApiBase}/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }

  const addToCart = useCallback(
    function addToCart(item: Omit<CartItem, "id">) {
      setCart((current) => {
        const existing = current.find((c) => c.variantId === item.variantId);
        if (existing) {
          return current.map((c) => (c === existing ? { ...c, qty: c.qty + 1 } : c));
        }
        return [...current, { ...item, id: crypto.randomUUID() }];
      });
    },
    [],
  );

  async function handleBarcodeSubmit() {
    const value = barcodeInput.trim();
    if (!value || barcodeBusyRef.current) return;
    barcodeBusyRef.current = true;
    setLookupError(null);
    try {
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
    } finally {
      barcodeBusyRef.current = false;
    }
  }

  async function handlePaymentLink() {
    if (!activeShift) {
      setLookupError("Open a shift before generating a payment link.");
      return;
    }
    if (cart.length === 0 || linkLoading || commitLoading) return;
    setLinkLoading(true);
    setLookupError(null);
    const items = cart.map((c) => ({
      variantId: c.variantId,
      quantity: c.qty,
    }));
    try {
      const res = await fetch(`${posCommerceApiBase}/draft-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, posFeatures }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLookupError(
          typeof err.error === "string" ? err.error : "Unable to create draft order",
        );
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
    } catch {
      setLookupError("Unable to create draft order. Try again.");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleCommitSale() {
    if (!activeShift) {
      setLookupError("Open a shift before committing a sale.");
      return;
    }
    if (cart.length === 0 || commitLoading || linkLoading) return;
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

    try {
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
      const res = await fetch(`${posCommerceApiBase}/commit-sale`, {
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
    } catch {
      setLookupError("Sale could not be completed. Try again.");
    } finally {
      setCommitLoading(false);
    }
  }

  async function handleOpenDrawer() {
    setHardwareMessage(null);
    try {
      await openCashDrawerRequest();
    } catch (e) {
      setHardwareMessage(formatHardwareError(e, "Cash drawer is temporarily unavailable. Check the terminal connection and try again."));
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
      (m) => setHardwareMessage(formatHardwareError(new Error(m), "Printer is temporarily unavailable. Check the terminal connection and try again.")),
    );
  }

  function printLabelFromQuickProduct(p: PosProductHit) {
    setHardwareMessage(null);
    fireAndForgetPrintLabel(
      buildProductLabelPayloadFromLineItem(p),
      (m) => setHardwareMessage(formatHardwareError(new Error(m), "Printer is temporarily unavailable. Check the terminal connection and try again.")),
    );
  }

  function removeFromCart(id: string) {
    setCart((current) => current.filter((c) => c.id !== id));
  }

  function updateQty(id: string, delta: number) {
    setCart((current) => {
      const next: CartItem[] = [];
      for (const item of current) {
        if (item.id !== id) {
          next.push(item);
          continue;
        }
        const newQty = Math.max(0, item.qty + delta);
        if (newQty > 0) {
          next.push(newQty === item.qty ? item : { ...item, qty: newQty });
        }
      }
      return next;
    });
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
    const controller = new AbortController();
    fetch(`${posCommerceApiBase}/suggestions`, { signal: controller.signal })
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
        if (!controller.signal.aborted) setSuggestions([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const q = searchInput.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const controller = new AbortController();
    if (!q) {
      setSearchResults([]);
      setSearchBusy(false);
      controller.abort();
      return;
    }
    setSearchBusy(true);
    searchDebounceRef.current = setTimeout(() => {
      void fetch(
        `${posCommerceApiBase}/search?${new URLSearchParams({ q })}`,
        { signal: controller.signal },
      )
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: { products?: PosProductHit[] }) => {
          setSearchResults(data.products ?? []);
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchBusy(false);
        });
    }, 320);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      controller.abort();
    };
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${posCommerceApiBase}/quick-products`, { signal: controller.signal })
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
        if (!controller.signal.aborted) setQuickProductsError(
          `Quick products unavailable (${err instanceof Error ? err.message : "no details"})`,
        );
      });
    return () => controller.abort();
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
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-start gap-2">
                <h1 className="text-4xl font-extrabold font-headline tracking-tight text-primary">
                  {activeShift?.device_name ?? "Terminal 01"}
                </h1>
                <AdminPageHelpFromPath />
              </div>
              <p className="text-on-surface-variant font-body mt-2">
                {activeShift
                  ? `Shift open since ${new Date(activeShift.opened_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}`
                  : "No active shift. Open a shift to begin."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Terminal status">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${activeShift ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  <span className={`size-2 rounded-full ${activeShift ? "bg-emerald-500" : "bg-amber-500"}`} />
                  Shift {activeShift ? "open" : "closed"}
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${online ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  <span className={`size-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {online ? "Network connected" : "Offline mode"}
                </span>
              </div>
            </div>
            <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
              {!activeShift ? (
                <Button type="button" variant="secondary" size="lg" onClick={() => setShowShiftOpen(true)} className="min-w-0 max-[379px]:w-full bg-emerald-600 text-white hover:bg-emerald-700">
                  <Play className="size-4" aria-hidden="true" />
                  Open Shift
                </Button>
              ) : (
                <Button type="button" variant="secondary" size="lg" onClick={() => setShowCloseShift(true)} className="min-w-0 max-[379px]:w-full bg-slate-600 text-white hover:bg-slate-700">
                  <Square className="size-4" aria-hidden="true" />
                  Close Shift
                </Button>
              )}
            </div>
          </div>
        </header>

        {successMessage && (
          <div role="status" aria-live="polite" className="bg-emerald-500/10 text-emerald-700 px-4 py-2 rounded text-sm font-medium flex items-center justify-between">
            <span>{successMessage}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSuccessMessage(null)}
              className="ml-4 text-emerald-600 hover:text-emerald-800"
            >
              Dismiss
            </Button>
          </div>
        )}
        {lookupError && (
          <div className="bg-error/10 text-error px-4 py-2 rounded text-sm font-medium">
            {lookupError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label htmlFor="pos-barcode-input" className="sr-only">Barcode or SKU</label>
            <Barcode className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
            <input
              id="pos-barcode-input"
              ref={barcodeInputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleBarcodeSubmit();
                }
              }}
              className="w-full bg-surface-container-highest border-none rounded py-4 pl-12 pr-4 focus:ring-1 focus:ring-secondary/40 font-body text-sm transition-[background-color,box-shadow]"
              placeholder="Scan Barcode or SKU..."
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-surface-container-low px-2 py-1 rounded text-[10px] font-bold text-on-surface-variant border border-outline-variant/20 uppercase tracking-tighter">
              F1
            </div>
          </div>
          <div className="relative">
            <label htmlFor="pos-product-search" className="sr-only">Product search</label>
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
            <input
              id="pos-product-search"
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-surface-container-highest border-none rounded py-4 pl-12 pr-4 focus:ring-1 focus:ring-secondary/40 font-body text-sm transition-[background-color,box-shadow]"
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
                    <Button
                      variant="ghost"
                      className="w-full justify-between rounded px-3 py-2 text-left hover:bg-surface-container-high"
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
                    >
                      <span className="text-sm font-medium line-clamp-2">{p.name}</span>
                      <span className="text-xs text-on-surface-variant shrink-0">
                        {p.sku ? `${p.sku} · ` : ""}
                        PHP {p.price.toLocaleString("en-PH")}
                      </span>
                    </Button>
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
                className="bg-surface-container-lowest p-4 transition-colors"
              >
                <div className="mb-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => printLabelFromQuickProduct(p)}
                    className="rounded bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant hover:bg-surface-dim"
                  >
                    Label
                  </Button>
                </div>
                <Button
                  variant="ghost"
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
                  className="flex h-auto w-full flex-col items-stretch justify-start gap-0 p-0 text-left"
                >
                  <div className="relative mb-4 aspect-square w-full overflow-hidden rounded bg-surface-container-high">
                    <PosProductImage
                      url={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="min-h-8 break-words text-xs font-bold uppercase tracking-tighter font-headline line-clamp-2">
                    {p.name}
                  </p>
                  <p className="text-sm text-on-surface-variant mt-1">
                    PHP {p.price.toLocaleString("en-PH")}
                  </p>
                </Button>
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
                  className="border border-outline-variant/20 bg-surface-container-lowest p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="mb-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => printLabelFromQuickProduct(p)}
                      className="rounded bg-surface-container-high px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-on-surface-variant hover:bg-surface-dim"
                    >
                      Label
                    </Button>
                  </div>
                  <Button
                  variant="ghost"
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
                    className="flex h-auto w-full flex-col items-stretch justify-start gap-0 p-0 text-left"
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
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="w-full lg:w-96 flex flex-col h-[calc(100dvh_-_4rem)] sticky top-8">
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
                  timeZone: "Asia/Manila",
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
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => handlePrintLabelForLine(item)}
                          className="text-on-surface-variant hover:text-primary transition-colors"
                          aria-label={`Print shelf label for ${item.name}`}
                          title="Print shelf label to thermal printer"
                        >
                          <Tag className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => { voidTargetRef.current = item.id; setShowVoidModal(true); }}
                          className="text-on-surface-variant hover:text-amber-600 transition-colors"
                          aria-label={`Void ${item.name}`}
                          title="Record void item"
                        >
                          <Ban className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-on-surface-variant hover:text-error transition-colors"
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center bg-surface-container-high rounded hover:bg-surface-dim transition-colors"
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          <Minus className="size-3" aria-hidden="true" />
                        </Button>
                        <span className="text-xs font-bold">{item.qty}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center bg-surface-container-high rounded hover:bg-surface-dim transition-colors"
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          <Plus className="size-3" aria-hidden="true" />
                        </Button>
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
            {activeShift ? <>
              <Button
                variant="secondary"
                size="lg"
                type="button"
                disabled={cart.length === 0 || linkLoading}
                onClick={() => void handlePaymentLink()}
                className="w-full uppercase tracking-widest"
              >
                <Link2 className="size-5" aria-hidden="true" />
                {linkLoading ? "Opening checkout…" : "Generate Payment Link"}
              </Button>
              <Button
                variant="default"
                size="lg"
                type="button"
                disabled={cart.length === 0 || commitLoading}
                onClick={handleCommitSale}
                className="w-full uppercase tracking-widest shadow-xl shadow-black/10"
              >
                <PackageCheck className="size-5" aria-hidden="true" />
                {commitLoading ? "Creating..." : "Commit Sale"}
              </Button>
            </> : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Checkout is locked</p>
                <p className="mt-1">Open a shift before generating payment links or committing a sale.</p>
              </div>
            )}
            <Button
              variant="outline"
              size="lg"
              type="button"
              onClick={() => void handleOpenDrawer()}
              className="w-full uppercase tracking-widest"
            >
              <CreditCard className="size-5" aria-hidden="true" />
              Open cash drawer
            </Button>
            <details className="px-1 text-[10px] text-on-surface-variant">
              <summary className="cursor-pointer font-semibold">Printer help</summary>
              <p className="mt-2 leading-relaxed">Receipts and shelf labels use the print program on this computer. Check the register connection and printer if a print job fails.</p>
            </details>
            {hardwareMessage ? (
              <p role="alert" className="text-xs text-amber-800 px-1">{hardwareMessage}</p>
            ) : null}
          </div>
        </div>
      </div>
      </div>

      <div className="fixed bottom-8 left-0 z-20 flex gap-4 lg:left-72">
        {pendingCount > 0 && (
          <Button
            type="button"
            onClick={() => void trySync()}
            disabled={syncing}
            variant="secondary"
            size="sm"
            className="rounded-full text-[10px] font-bold uppercase tracking-widest"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            {syncing ? "Syncing..." : `${pendingCount} pending`}
          </Button>
        )}
      </div>

      {showShiftOpen && (
        <ModalPortal>
        <dialog open aria-labelledby="open-shift-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6">
        <form onSubmit={handleOpenShift} className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-8">
            <h2 id="open-shift-title" className="text-lg font-bold font-headline">Open Shift</h2>
            <label htmlFor="pos-shift-employee" className="sr-only">Employee ID</label>
            <input id="pos-shift-employee" required placeholder="Employee ID" value={shiftForm.employee_id} onChange={(e) => setShiftForm({ ...shiftForm, employee_id: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <label htmlFor="pos-shift-device" className="sr-only">Device name</label>
            <input id="pos-shift-device" required placeholder="Device name" value={shiftForm.device_name} onChange={(e) => setShiftForm({ ...shiftForm, device_name: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <label htmlFor="pos-shift-opening-cash" className="sr-only">Opening cash</label>
            <input id="pos-shift-opening-cash" type="number" step="0.01" placeholder="Opening cash" value={shiftForm.opening_cash} onChange={(e) => setShiftForm({ ...shiftForm, opening_cash: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowShiftOpen(false)} className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</Button>
              <Button type="submit" className="text-xs font-bold uppercase tracking-widest">Open</Button>
            </div>
        </form>
        </dialog>
        </ModalPortal>
      )}

      {showCloseShift && (
        <ModalPortal>
        <dialog open aria-labelledby="close-shift-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6">
        <form onSubmit={handleCloseShift} className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-8">
            <h2 id="close-shift-title" className="text-lg font-bold font-headline">Close Shift</h2>
            <p className="text-sm text-on-surface-variant">Opening cash: PHP {activeShift?.opening_cash?.toLocaleString("en-PH")}</p>
            <label htmlFor="pos-shift-closing-cash" className="sr-only">Closing cash amount</label>
            <input id="pos-shift-closing-cash" required type="number" step="0.01" placeholder="Closing cash amount" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" autoFocus />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowCloseShift(false)} className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</Button>
              <Button type="submit" variant="secondary" className="text-xs font-bold uppercase tracking-widest">Close Shift</Button>
            </div>
        </form>
        </dialog>
        </ModalPortal>
      )}

      {showVoidModal && (
        <ModalPortal>
        <dialog open aria-labelledby="void-override-title" className="fixed inset-0 z-[100] m-0 flex h-dvh w-dvw max-w-none items-center justify-center overflow-y-auto border-0 bg-black/40 p-4 sm:p-6">
        <form onSubmit={handleVoid} className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-8">
            <h2 id="void-override-title" className="text-lg font-bold font-headline">Void / Override</h2>
            <select aria-label="Void action" disabled value={voidForm.action} onChange={(e) => setVoidForm({ ...voidForm, action: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40 disabled:bg-surface-container-low disabled:text-on-surface-variant">
              <option value="void_item">Void Item</option>
            </select>
            <p className="text-xs text-on-surface-variant">
              This records a cart-line void. Use the Orders workflow for order-level refunds, voids, or discount overrides.
            </p>
            <label htmlFor="pos-void-reason" className="sr-only">Void reason</label>
            <input id="pos-void-reason" required placeholder="Reason" value={voidForm.reason} onChange={(e) => setVoidForm({ ...voidForm, reason: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            <div className="border-t border-outline-variant/20 pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Manager Approval</p>
              <label htmlFor="pos-manager-employee" className="sr-only">Manager employee ID</label>
              <input id="pos-manager-employee" placeholder="Manager Employee ID" value={voidForm.approver_id} onChange={(e) => setVoidForm({ ...voidForm, approver_id: e.target.value })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40 mb-2" />
              <label htmlFor="pos-manager-pin" className="sr-only">Manager PIN</label>
              <input id="pos-manager-pin" type="password" placeholder="Manager PIN" value={voidForm.pin} onChange={(e) => setVoidForm({ ...voidForm, pin: e.target.value.replace(/\D/g, "") })} className="w-full border border-outline-variant/20 rounded px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/40" />
            </div>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="ghost" onClick={() => { setShowVoidModal(false); voidTargetRef.current = null; }} className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cancel</Button>
              <Button type="submit" className="bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold uppercase tracking-widest">Confirm Void</Button>
            </div>
        </form>
        </dialog>
        </ModalPortal>
      )}
    </AdminPageShell>
  );
}
