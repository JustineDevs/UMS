"use client";

import Link from "next/link";
import { parseAsInteger, useQueryStates } from "nuqs";
import { useEffect, useReducer, useState } from "react";
import { AlertTriangle, Boxes, PackageCheck, PackageX } from "lucide-react";
import {
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@universal-music-store/ui";
import {
  writeAdminPreferences,
  type AdminPreferences,
} from "@universal-music-store/user-preferences";

export type InventoryRow = {
  variantId: string;
  productId?: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  available: number;
};

const POLL_MS = 15_000;

const PAGE_SIZE_OPTIONS: AdminPreferences["inventoryPageSize"][] = [25, 50, 100];

type LiveState = {
  rows: InventoryRow[];
  totalCount: number;
  lastSync: string | null;
  error: string | null;
  mode: "sse" | "poll" | "connecting";
};

type LiveAction =
  | { type: "rows"; rows: InventoryRow[] }
  | { type: "total"; total: number }
  | { type: "sync"; at: string }
  | { type: "error"; message: string | null }
  | { type: "mode"; mode: LiveState["mode"] }
  | { type: "reset"; rows: InventoryRow[]; total: number };

function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case "rows": return { ...state, rows: action.rows };
    case "total": return { ...state, totalCount: action.total };
    case "sync": return { ...state, lastSync: action.at };
    case "error": return { ...state, error: action.message };
    case "mode": return { ...state, mode: action.mode };
    case "reset": return { ...state, rows: action.rows, totalCount: action.total };
    default: return state;
  }
}

function formatSyncLabel(mode: "sse" | "poll" | "connecting"): string {
  if (mode === "sse") return "live updates";
  if (mode === "connecting") return "connecting…";
  return `refresh every ${POLL_MS / 1000}s`;
}

function buildQuery(page: number, pageSize: number): string {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return p.toString();
}

export function InventoryTableWithRefresh({
  initialRows,
  page,
  pageSize,
  total,
}: {
  initialRows: InventoryRow[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const [, setQuery] = useQueryStates(
    {
      page: parseAsInteger.withDefault(page),
      pageSize: parseAsInteger.withDefault(pageSize),
    },
    { history: "push", shallow: false },
  );
  const [{ rows, totalCount, lastSync, error, mode }, dispatchLive] = useReducer(
    liveReducer,
    { rows: initialRows, totalCount: total, lastSync: null, error: null, mode: "connecting" },
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<"set" | "delta">("set");
  const [quantity, setQuantity] = useState(0);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<
    "receive" | "count" | "damage" | "loss" | "return" | "correction" | "transfer"
  >("correction");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    dispatchLive({ type: "reset", rows: initialRows, total });
  }, [initialRows, total]);

  useEffect(() => {
    let cancelled = false;
    const fallbackMs = 4000;
    const timer = window.setTimeout(() => {
      dispatchLive({ type: "mode", mode: "poll" });
    }, fallbackMs);
    if (typeof EventSource === "undefined") {
      window.clearTimeout(timer);
      dispatchLive({ type: "mode", mode: "poll" });
      return undefined;
    }
    const q = buildQuery(page, pageSize);
    const es = new EventSource(`/api/admin/inventory/stream?${q}`);
    es.onmessage = (ev) => {
      window.clearTimeout(timer);
      try {
        const data = JSON.parse(ev.data) as {
          rows?: InventoryRow[];
          page?: number;
          pageSize?: number;
          total?: number;
        };
        if (!cancelled && Array.isArray(data.rows)) {
          if (data.page === page && data.pageSize === pageSize) {
            dispatchLive({ type: "rows", rows: data.rows });
            if (typeof data.total === "number") {
              dispatchLive({ type: "total", total: data.total });
            }
            dispatchLive({ type: "sync", at: new Date().toISOString() });
            dispatchLive({ type: "error", message: null });
            dispatchLive({ type: "mode", mode: "sse" });
          }
        }
      } catch {
        if (!cancelled) dispatchLive({ type: "error", message: "Update unavailable" });
      }
    };
    es.onerror = () => {
      window.clearTimeout(timer);
      es.close();
      if (!cancelled) dispatchLive({ type: "mode", mode: "poll" });
    };
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      es.close();
    };
  }, [page, pageSize]);

  useEffect(() => {
    if (mode !== "poll") return;
    let cancelled = false;
    const controller = new AbortController();
    async function pull() {
      try {
        const res = await fetch(`/api/admin/inventory?${buildQuery(page, pageSize)}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          dispatchLive({ type: "error", message: `Update unsuccessful (${res.status})` });
          return;
        }
        const data = (await res.json()) as {
          rows?: InventoryRow[];
          page?: number;
          pageSize?: number;
          total?: number;
        };
        if (
          !cancelled &&
          Array.isArray(data.rows) &&
          data.page === page &&
          data.pageSize === pageSize
        ) {
          dispatchLive({ type: "rows", rows: data.rows });
          if (typeof data.total === "number") {
            dispatchLive({ type: "total", total: data.total });
          }
          dispatchLive({ type: "sync", at: new Date().toISOString() });
          dispatchLive({ type: "error", message: null });
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) dispatchLive({ type: "error", message: "Refresh unavailable" });
      }
    }
    const id = window.setInterval(pull, POLL_MS);
    void pull();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, [mode, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));
  const showPager = totalCount > 0;

  function applyDefaultPageSize(next: AdminPreferences["inventoryPageSize"]) {
    writeAdminPreferences({ inventoryPageSize: next });
    void setQuery({ page: 1, pageSize: next });
  }

  const visibleUnits = rows.reduce((sum, row) => sum + Math.max(0, row.available), 0);
  const lowStockCount = rows.filter((row) => row.available > 0 && row.available <= 5).length;
  const outOfStockCount = rows.filter((row) => row.available <= 0).length;

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Total variants</span>
            <Boxes className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{totalCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across the current catalog</p>
        </article>
        <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Units on page</span>
            <PackageCheck className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{visibleUnits}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available stock in this view</p>
        </article>
        <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Low stock</span>
            <AlertTriangle className="size-4 text-amber-600" />
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{lowStockCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Between 1 and 5 units</p>
        </article>
        <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Out of stock</span>
            <PackageX className="size-4 text-destructive" />
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{outOfStockCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Needs replenishment</p>
        </article>
      </div>
      <p className="mb-4 text-xs font-medium text-on-surface-variant">
        Last updated: {lastSync ?? "not available"}
        {error ? (
          <span className="ml-2 text-error" role="alert">
            {error}
          </span>
        ) : null}
        <span className="ml-2 text-on-surface-variant/80">
          ({formatSyncLabel(mode)})
        </span>
      </p>
      <Card className="overflow-hidden shadow-[0px_20px_40px_rgba(0,0,0,0.02)]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-surface-container-high hover:bg-transparent data-[state=selected]:bg-transparent">
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-16 text-center text-on-surface-variant"
                  >
                    No stock to show yet. Add products in your main store admin
                    first.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.variantId}>
                    <TableCell className="font-medium text-primary">
                      {row.productName}
                    </TableCell>
                    <TableCell className="text-sm text-on-surface-variant">
                      {row.sku}
                    </TableCell>
                    <TableCell className="text-sm text-on-surface-variant">
                      {row.size}
                    </TableCell>
                    <TableCell className="text-sm text-on-surface-variant">
                      {row.color}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.available}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === row.variantId ? (
                        <form
                          className="flex justify-end gap-1"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (savingId) return;
                            if (!row.productId) {
                              dispatchLive({ type: "error", message: "This variant has no product reference" });
                              return;
                            }
                            setSavingId(row.variantId);
                            dispatchLive({ type: "error", message: null });
                            try {
                            const response = await fetch("/api/admin/inventory/adjust", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  "Idempotency-Key": crypto.randomUUID(),
                                },
                                body: JSON.stringify({
                                  productId: row.productId,
                                  variantId: row.variantId,
                                  ...(adjustmentMode === "set"
                                    ? { stockedQuantity: quantity }
                                    : { delta }),
                                  expectedStockedQuantity: row.available,
                                  reason,
                                }),
                              });
                              if (!response.ok) {
                                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                                dispatchLive({ type: "error", message: payload?.error ?? `Unable to save stock (${response.status})` });
                                return;
                              }
                              const payload = (await response.clone().json().catch(() => null)) as {
                                data?: { availableQuantity?: number | null };
                              } | null;
                              const nextQuantity = payload?.data?.availableQuantity;
                              if (typeof nextQuantity !== "number") {
                                dispatchLive({ type: "error", message: "Inventory was saved but the authoritative available quantity could not be read; refresh the table." });
                                return;
                              }
                              dispatchLive({ type: "rows", rows: rows.map((item) => item.variantId === row.variantId ? { ...item, available: nextQuantity } : item) });
                              setEditingId(null);
                            } catch {
                              dispatchLive({ type: "error", message: "Unable to save stock" });
                            } finally {
                              setSavingId(null);
                            }
                          }}
                        >
                          <select
                            aria-label={`Adjustment mode for ${row.productName}`}
                            className="rounded border px-2 py-1 text-xs"
                            value={adjustmentMode}
                            onChange={(event) => setAdjustmentMode(event.target.value as "set" | "delta")}
                          >
                            <option value="set">Set</option>
                            <option value="delta">Delta</option>
                          </select>
                          <input
                            aria-label={`${adjustmentMode === "set" ? "Stock quantity" : "Stock change"} for ${row.productName}`}
                            type="number"
                            min={adjustmentMode === "set" ? 0 : undefined}
                            className="w-20 rounded border px-2 py-1 text-right"
                            value={adjustmentMode === "set" ? quantity : delta}
                            onChange={(event) => {
                              const raw = event.target.value.trim();
                              if (!raw) return;
                              const value = Number(raw);
                              if (!Number.isFinite(value)) return;
                              if (adjustmentMode === "set") setQuantity(value);
                              else setDelta(value);
                            }}
                          />
                          <select
                            aria-label={`Adjustment reason for ${row.productName}`}
                            className="max-w-28 rounded border px-2 py-1 text-xs"
                            value={reason}
                            onChange={(event) => setReason(event.target.value as typeof reason)}
                          >
                            <option value="correction">Correction</option>
                            <option value="receive">Receive</option>
                            <option value="count">Count</option>
                            <option value="damage">Damage</option>
                            <option value="loss">Loss</option>
                            <option value="return">Return</option>
                            <option value="transfer">Transfer</option>
                          </select>
                          <Button type="submit" size="sm" className="text-xs" disabled={savingId === row.variantId}>{savingId === row.variantId ? "..." : "Save"}</Button>
                          <button
                            type="button"
                            className="rounded border border-outline-variant/40 px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container"
                            onClick={() => {
                              setEditingId(null);
                              dispatchLive({ type: "error", message: null });
                            }}
                            disabled={savingId === row.variantId}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => { setEditingId(row.variantId); setAdjustmentMode("set"); setQuantity(Math.max(0, row.available)); setDelta(0); setReason("correction"); }}>Adjust</button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showPager ? (
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-on-surface-variant">
            Page {page} of {totalPages} · {totalCount} variant
            {totalCount === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="font-semibold uppercase tracking-wide">Rows</span>
              <select
                className="rounded border border-outline-variant/30 bg-white px-2 py-1.5 text-sm text-on-surface"
                value={pageSize}
                onChange={(e) => {
                  const v = Number(e.target.value) as AdminPreferences["inventoryPageSize"];
                  applyDefaultPageSize(v);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              {page <= 1 ? (
                <span className="rounded border border-outline-variant/15 px-3 py-1.5 text-xs text-on-surface-variant/50">
                  Previous
                </span>
              ) : (
                <Link
                  href={`/admin/inventory?${buildQuery(page - 1, pageSize)}`}
                  className="rounded border border-outline-variant/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-container-low"
                >
                  Previous
                </Link>
              )}
              {page >= totalPages ? (
                <span className="rounded border border-outline-variant/15 px-3 py-1.5 text-xs text-on-surface-variant/50">
                  Next
                </span>
              ) : (
                <Link
                  href={`/admin/inventory?${buildQuery(page + 1, pageSize)}`}
                  className="rounded border border-outline-variant/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-container-low"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
