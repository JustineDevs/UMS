"use client";

import Link from "next/link";
import { parseAsInteger, useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
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
  const [rows, setRows] = useState(initialRows);
  const [totalCount, setTotalCount] = useState(total);
  // Keep the first render deterministic; the browser supplies the live timestamp after mount.
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"sse" | "poll" | "connecting">("connecting");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<"set" | "delta">("set");
  const [quantity, setQuantity] = useState(0);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<
    "receive" | "count" | "damage" | "loss" | "return" | "correction" | "transfer"
  >("correction");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setLastSync(new Date().toISOString());
  }, []);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setTotalCount(total);
  }, [total]);

  useEffect(() => {
    let cancelled = false;
    const fallbackMs = 4000;
    const timer = window.setTimeout(() => {
      setMode((m) => (m === "connecting" ? "poll" : m));
    }, fallbackMs);
    if (typeof EventSource === "undefined") {
      window.clearTimeout(timer);
      setMode("poll");
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
            setRows(data.rows);
            if (typeof data.total === "number") {
              setTotalCount(data.total);
            }
            setLastSync(new Date().toISOString());
            setError(null);
            setMode("sse");
          }
        }
      } catch {
        if (!cancelled) setError("Update unavailable");
      }
    };
    es.onerror = () => {
      window.clearTimeout(timer);
      es.close();
      if (!cancelled) setMode("poll");
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
    async function pull() {
      try {
        const res = await fetch(`/api/admin/inventory?${buildQuery(page, pageSize)}`, {
          credentials: "include",
        });
        if (!res.ok) {
          setError(`Update unsuccessful (${res.status})`);
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
          setRows(data.rows);
          if (typeof data.total === "number") {
            setTotalCount(data.total);
          }
          setLastSync(new Date().toISOString());
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Refresh unavailable");
      }
    }
    const id = window.setInterval(pull, POLL_MS);
    void pull();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mode, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));
  const showPager = totalCount > 0;

  function applyDefaultPageSize(next: AdminPreferences["inventoryPageSize"]) {
    writeAdminPreferences({ inventoryPageSize: next });
    void setQuery({ page: 1, pageSize: next });
  }

  return (
    <div>
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
                            if (!row.productId) {
                              setError("This variant has no product reference");
                              return;
                            }
                            setSavingId(row.variantId);
                            setError(null);
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
                                setError(payload?.error ?? `Unable to save stock (${response.status})`);
                                return;
                              }
                              const payload = (await response.clone().json().catch(() => null)) as {
                                data?: { availableQuantity?: number | null };
                              } | null;
                              const nextQuantity = payload?.data?.availableQuantity;
                              if (typeof nextQuantity !== "number") {
                                setError("Inventory was saved but the authoritative available quantity could not be read; refresh the table.");
                                return;
                              }
                              setRows((current) => current.map((item) => item.variantId === row.variantId ? { ...item, available: nextQuantity } : item));
                              setEditingId(null);
                            } catch {
                              setError("Unable to save stock");
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
                              const value = Number(event.target.value);
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
                          <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground" disabled={savingId === row.variantId}>{savingId === row.variantId ? "..." : "Save"}</button>
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
