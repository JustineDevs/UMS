"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { MedusaOrderRow } from "@/lib/medusa-order-bridge";

async function downloadJntCsv(orderIds: string[]): Promise<string | null> {
  const res = await fetch("/api/admin/orders/export-jnt-csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderIds }),
  });
  if (!res.ok) return `Export failed (HTTP ${res.status})`;
  const blob = await res.blob();
  const filename =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    "jnt-export.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

type BulkFulfillResult = {
  orderId: string;
  ok: boolean;
  error?: string;
};

type BulkResponse = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: BulkFulfillResult[];
};

export function OrdersPageClient({
  orders,
  total,
}: {
  orders: MedusaOrderRow[];
  total: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResponse | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const allIds = orders.map((o) => o.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }, [allSelected, allIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openBulkModal = () => {
    setBulkResult(null);
    setBulkError(null);
    setShowModal(true);
  };

  const runBulkFulfill = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/admin/orders/bulk-fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: [...selected],
          trackingNumber: trackingInput.trim() || undefined,
          notifyCustomer,
        }),
      });
      const json = (await res.json()) as BulkResponse & { error?: string };
      if (!res.ok) {
        setBulkError(json.error ?? "Bulk fulfill failed");
      } else {
        setBulkResult(json);
        setSelected(new Set());
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <>
      {someSelected && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-3">
          <span className="text-sm font-medium text-on-surface">
            {selected.size} order{selected.size !== 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            onClick={openBulkModal}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            Bulk Fulfill
          </button>
          <button
            type="button"
            disabled={exportLoading}
            onClick={async () => {
              setExportLoading(true);
              setExportError(null);
              const err = await downloadJntCsv([...selected]);
              setExportLoading(false);
              if (err) setExportError(err);
            }}
            className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            {exportLoading ? "Exporting…" : "Export J&T CSV"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-outline-variant/30 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            Clear selection
          </button>
          {exportError && (
            <span className="text-xs text-red-600">{exportError}</span>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-surface-container-lowest shadow-[0px_20px_40px_rgba(0,0,0,0.02)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-container-high">
              <th className="py-4 px-4 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all orders"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-outline-variant/50 accent-primary cursor-pointer"
                />
              </th>
              <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Order
              </th>
              <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Customer
              </th>
              <th className="text-left py-4 px-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Status
              </th>
              <th className="text-right py-4 px-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-16 text-center text-on-surface-variant"
                >
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className={`border-b border-surface-container-high/50 transition-colors ${
                    selected.has(o.id) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="py-4 px-4">
                    <input
                      type="checkbox"
                      aria-label={`Select order ${o.order_number}`}
                      checked={selected.has(o.id)}
                      onChange={() => toggleOne(o.id)}
                      className="h-4 w-4 rounded border-outline-variant/50 accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="py-4 px-4 font-medium text-primary">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="py-4 px-4 text-on-surface-variant text-sm">
                    {o.email ?? (o.customer_id ? "Customer" : "Guest")}
                  </td>
                  <td className="py-4 px-4 text-on-surface-variant text-sm">
                    {o.status.replace(/_/g, " ")}
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    {o.currency} {Number(o.grand_total).toLocaleString("en-PH")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-right text-xs text-on-surface-variant">
        Showing {orders.length} of {total}
      </p>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-fulfill-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
            <h2
              id="bulk-fulfill-title"
              className="mb-4 text-lg font-bold text-on-surface"
            >
              Bulk Fulfill {selected.size > 0 ? `(${selected.size} orders)` : ""}
            </h2>

            {bulkResult ? (
              <div>
                <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-emerald-500/10 px-3 py-3">
                    <p className="text-2xl font-bold text-emerald-700">{bulkResult.succeeded}</p>
                    <p className="text-xs text-emerald-600">Fulfilled</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 px-3 py-3">
                    <p className="text-2xl font-bold text-amber-700">{bulkResult.skipped}</p>
                    <p className="text-xs text-amber-600">Skipped</p>
                  </div>
                  <div className="rounded-lg bg-red-500/10 px-3 py-3">
                    <p className="text-2xl font-bold text-red-700">{bulkResult.failed}</p>
                    <p className="text-xs text-red-600">Failed</p>
                  </div>
                </div>

                {bulkResult.results.filter((r) => !r.ok).length > 0 && (
                  <ul className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs">
                    {bulkResult.results
                      .filter((r) => !r.ok)
                      .map((r) => (
                        <li key={r.orderId} className="text-red-700">
                          {r.orderId}: {r.error}
                        </li>
                      ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Tracking Number (optional, applied to all)
                  </label>
                  <input
                    type="text"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    placeholder="e.g. JT123456789PH"
                    className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <label className="mb-5 flex items-center gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={notifyCustomer}
                    onChange={(e) => setNotifyCustomer(e.target.checked)}
                    className="h-4 w-4 rounded border-outline-variant/50 accent-primary"
                  />
                  Notify customers by email
                </label>

                {bulkError && (
                  <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {bulkError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-lg border border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface-variant"
                    disabled={bulkLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={runBulkFulfill}
                    disabled={bulkLoading}
                    className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
                  >
                    {bulkLoading ? "Processing..." : `Fulfill ${selected.size} Orders`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
