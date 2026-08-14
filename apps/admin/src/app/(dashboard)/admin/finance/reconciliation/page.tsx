"use client";

import { useEffect, useState } from "react";
import type { ReconciliationSummary } from "@/app/api/admin/reconciliation/route";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    matched: "bg-green-100 text-green-800",
    discrepancy: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function ReconciliationPage() {
  const [data, setData] = useState<ReconciliationSummary | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/reconciliation?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payment Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">Payment provider payouts compared with store orders</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>


      {loading && <p className="text-gray-500">Loading reconciliation data...</p>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Store total</p>
              <p className="text-2xl font-semibold mt-1">
                {(data.totalMedusaMinor / 100).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Provider confirmed</p>
              <p className="text-2xl font-semibold mt-1">
                {(data.totalProviderConfirmedMinor / 100).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Discrepancy</p>
              <p className={`text-2xl font-semibold mt-1 ${data.totalDiscrepancyMinor !== 0 ? "text-red-600" : "text-green-600"}`}>
                {(data.totalDiscrepancyMinor / 100).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
              </p>
            </div>
          </div>
          {(data.paymentAttemptsStaleFinalize > 0 || data.paymentAttemptsNeedsReview > 0) && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">Payment recovery needs attention</p>
              <p className="mt-1 text-amber-900/90">
                {data.paymentAttemptsStaleFinalize} stale/finalization rows and{" "}
                {data.paymentAttemptsNeedsReview} rows already marked for review are affecting clean reconciliation.
              </p>
              <p className="mt-2 text-xs text-amber-900/80">
                Provider-confirmed totals below come from the current payment ledger, not external settlement files.
              </p>
              <a
                href="/admin/payments"
                className="mt-3 inline-flex rounded border border-amber-500 px-3 py-2 text-xs font-bold uppercase tracking-widest text-amber-900 transition-colors hover:bg-amber-100"
              >
                Open payment attempts
              </a>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Store orders</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Store total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Provider confirmed</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Open</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Problem</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Discrepancy</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{row.date}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{row.provider}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.medusaOrderCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{(row.medusaTotalMinor / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{(row.providerConfirmedMinor / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.openAttemptCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.problemAttemptCount}</td>
                    <td className={`px-4 py-3 text-right ${row.discrepancyMinor !== 0 ? "text-red-600" : "text-gray-700"}`}>
                      {(row.discrepancyMinor / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.recentProblemAttempts.length > 0 ? (
            <div className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Recent payment attempts affecting reconciliation
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-white">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentProblemAttempts.map((row) => (
                    <tr key={row.correlationId} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 text-gray-700 capitalize">{row.provider}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status === "expired" ? "discrepancy" : "pending"} />
                        <div className="mt-1 text-[11px] text-gray-400">{row.checkoutState}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {row.staleReason ?? "Needs review"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(row.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
