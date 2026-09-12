"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@universal-music-store/ui";

type ReviewRow = {
  id: string;
  product_slug: string;
  medusa_product_id: string | null;
  rating: number;
  author_name: string;
  body: string;
  status: string;
  created_at: string;
  customer_email: string | null;
  medusa_customer_id: string | null;
  is_verified_buyer: boolean | null;
  verified_medusa_order_id: string | null;
  moderated_by_staff_email: string | null;
  moderated_at: string | null;
  moderation_note: string | null;
  risk_score: number;
  shadow_banned: boolean;
  open_report_count: number;
};

export function ReviewsModerationClient() {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (statusFilter) p.set("status", statusFilter);
      if (q.trim().length >= 2) p.set("q", q.trim());
      p.set("limit", "100");
      const res = await fetch(`/api/admin/reviews?${p.toString()}`);
      const j = (await res.json()) as { reviews?: ReviewRow[]; error?: string };
      if (!res.ok) {
        setError(j.error ?? "Failed to load");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.reviews) ? j.reviews : []);
    } catch {
      setError("Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moderate(id: string, status: "approved" | "rejected" | "hidden", shadowBanned?: boolean) {
    setActing(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(shadowBanned === undefined ? {} : { shadow_banned: shadowBanned }) }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Update failed");
        return;
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Search (body, name, email)
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void load()}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder="Min 2 characters"
          />
        </label>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Apply
        </Button>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No reviews match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">Body</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Verified</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Reports</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-xs" title={r.medusa_product_id ?? ""}>
                    {r.product_slug}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-xs" title={r.customer_email ?? ""}>
                    {r.customer_email ?? "—"}
                  </td>
                  <td className="px-3 py-2">{r.rating}</td>
                  <td className="max-w-md px-3 py-2 text-xs text-slate-700">
                    {r.body.length > 160 ? `${r.body.slice(0, 160)}…` : r.body}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.status}</td>
                  <td className="px-3 py-2">{r.is_verified_buyer ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{r.risk_score ?? 0}{r.shadow_banned ? " (shadow)" : ""}</td>
                  <td className="px-3 py-2">
                    {r.open_report_count > 0 ? (
                      <span className="font-semibold text-red-700">{r.open_report_count} open</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="space-x-1 whitespace-nowrap px-3 py-2">
                    {r.status !== "approved" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={acting === r.id}
                        onClick={() => void moderate(r.id, "approved")}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {r.status !== "hidden" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={acting === r.id}
                        onClick={() => void moderate(r.id, "hidden")}
                      >
                        Hide
                      </Button>
                    ) : null}
                    {r.status !== "rejected" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={acting === r.id}
                        onClick={() => void moderate(r.id, "rejected")}
                      >
                        Reject
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={acting === r.id}
                      onClick={() => void moderate(r.id, r.status as "approved" | "rejected" | "hidden", !r.shadow_banned)}
                    >
                      {r.shadow_banned ? "Unshadow" : "Shadow ban"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
