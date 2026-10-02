"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@universal-music-store/ui";
import { useSession } from "@/lib/auth-client";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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

function reviewErrorMessage(error: string | undefined, fallback: string) {
  if (error?.toLowerCase().includes("worker backend is unavailable")) {
    return "Review moderation is temporarily unavailable. Try again shortly.";
  }
  switch (error) {
    case "invalid_filter":
      return "That review filter is not available. Choose another status or clear the search.";
    case "worker_unavailable":
    case "Failed to fetch":
    case "NetworkError":
    case "Load failed":
      return "Review moderation is temporarily unavailable. Try again shortly.";
    default:
      return error || fallback;
  }
}

export function ReviewsModerationClient() {
  const { data: session } = useSession();
  const canModerate = staffHasPermission(session?.user?.permissions ?? [], "content:write");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const didInitialLoad = useRef(false);

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
        setError(reviewErrorMessage(j.error, "Failed to load reviews."));
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
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
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
        setError(reviewErrorMessage(j.error, "Unable to update review."));
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
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[12rem_minmax(0,1fr)_auto] lg:items-end">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Status
          <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
            <SelectTrigger aria-label="Filter reviews by status" size="sm" className="h-10 w-full bg-background"><SelectValue placeholder={statusFilter || "All reviews"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reviews</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground lg:min-w-[200px]">
          Search (body, name, email)
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void load()}
            aria-label="Search reviews"
            className="h-10 bg-background"
            placeholder="Search customer, product, or review text"
          />
          {q.trim().length === 1 ? <span className="text-xs font-normal text-destructive">Enter at least 2 characters or clear the search.</span> : null}
        </label>
        <Button type="button" variant="secondary" disabled={q.trim().length === 1} onClick={() => void load()} className="h-10 w-full lg:w-auto">
          Apply filters
        </Button>
        </div>
        {!canModerate ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status">
            Review actions are unavailable for your role. Ask an administrator for content moderation access.
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      ) : null}

      {loading ? (
        <div aria-label="Loading review moderation queue" aria-live="polite" className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
          <div className="min-w-[760px] animate-pulse space-y-3">
            <div className="grid grid-cols-6 gap-4 border-b border-slate-100 pb-3">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-3 rounded bg-slate-200" />)}
            </div>
            {Array.from({ length: 5 }, (_, row) => (
              <div key={row} className="grid grid-cols-6 gap-4 border-b border-slate-100 py-4 last:border-0">
                {Array.from({ length: 6 }, (_, column) => <div key={column} className="h-4 rounded bg-slate-100" />)}
              </div>
            ))}
          </div>
        </div>
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
                        disabled={!canModerate || acting === r.id}
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
                        disabled={!canModerate || acting === r.id}
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
                        disabled={!canModerate || acting === r.id}
                        onClick={() => void moderate(r.id, "rejected")}
                      >
                        Reject
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!canModerate || acting === r.id}
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
