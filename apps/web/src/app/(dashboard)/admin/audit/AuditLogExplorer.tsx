"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { formatAuditActorLabel } from "@/lib/audit-actor-format";
import {
  formatAuditActionLabel,
  formatAuditResourceLabel,
} from "@/lib/audit-display-format";
import { AdminEmptyState, AdminErrorState } from "@/components/admin-console";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AuditEntry = {
  id: string;
  action: string;
  resource: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_id?: string | null;
  users?: { email?: string | null; name?: string | null } | null;
};

const RESOURCE_OPTIONS = [
  { value: "", label: "All resources" },
  { value: "order:", label: "Orders" },
  { value: "product:", label: "Products" },
  { value: "inventory_", label: "Inventory" },
  { value: "cms_", label: "Content and CMS" },
  { value: "payment", label: "Payments" },
  { value: "customer", label: "Customers" },
  { value: "pos_", label: "Point of sale" },
  { value: "delivery", label: "Delivery" },
];

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "staff_", label: "Staff actions" },
  { value: "orders.", label: "Order actions" },
  { value: "inventory.", label: "Inventory actions" },
  { value: "cms.", label: "Content actions" },
  { value: "payment", label: "Payment actions" },
  { value: "crm.", label: "CRM actions" },
  { value: "delivery.", label: "Delivery actions" },
  { value: "pos.", label: "POS actions" },
];

function AuditLogSkeleton() {
  return (
    <div
      aria-label="Loading audit entries"
      aria-live="polite"
      className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4"
    >
      <div className="space-y-3 animate-pulse">
        {["w-11/12", "w-9/12", "w-full", "w-10/12", "w-8/12"].map((width, index) => (
          <div key={index} className={`h-4 rounded bg-muted ${width}`} />
        ))}
      </div>
    </div>
  );
}

export function AuditLogExplorer() {
  const { data: session } = useSession();
  const canExport = staffHasPermission(session?.user?.permissions ?? [], "analytics:export");

  const [resourcePrefix, setResourcePrefix] = useState("");
  const [actionPrefix, setActionPrefix] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(50);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const didInitialLoad = useRef(false);

  const resourceLabel = RESOURCE_OPTIONS.find((option) => option.value === resourcePrefix)?.label ?? "All resources";
  const actionLabel = ACTION_OPTIONS.find((option) => option.value === actionPrefix)?.label ?? "All actions";

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(500, Math.max(1, limit))));
    if (resourcePrefix.trim()) params.set("resource_prefix", resourcePrefix.trim());
    if (actionPrefix.trim()) params.set("action_prefix", actionPrefix.trim());
    if (from.trim()) params.set("from", new Date(from).toISOString());
    if (to.trim()) params.set("to", new Date(to).toISOString());

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setError(null);
    setEntries(null);
    fetch(`/api/admin/audit-logs?${params.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Audit log request failed (${r.status})`);
        return r.json();
      })
      .then((body) => {
        if (body.error) {
          setError(body.error);
          setEntries([]);
          return;
        }
        setEntries((body.entries as AuditEntry[]) ?? []);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError("Unable to load audit logs");
        setEntries([]);
      });
  }, [resourcePrefix, actionPrefix, from, to, limit]);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    load();
  }, [load]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function downloadCsv() {
    const params = new URLSearchParams();
    params.set("format", "csv");
    params.set("limit", "500");
    if (resourcePrefix.trim()) params.set("resource_prefix", resourcePrefix.trim());
    if (actionPrefix.trim()) params.set("action_prefix", actionPrefix.trim());
    if (from.trim()) params.set("from", new Date(from).toISOString());
    if (to.trim()) params.set("to", new Date(to).toISOString());
    window.location.href = `/api/admin/audit-logs?${params.toString()}`;
  }

  function resetFilters() {
    setResourcePrefix("");
    setActionPrefix("");
    setFrom("");
    setTo("");
    setLimit(50);
  }

  return (
    <div className="space-y-6">
      <div className="border-y border-border/70 py-5">
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Filter activity</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Narrow the log by the system area, action family, result count, or time window.
            </p>
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div className="block min-w-0 text-sm">
              <span className="text-xs font-medium text-foreground">Resource</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">What changed</span>
              <Select value={resourcePrefix || "all"} onValueChange={(value) => setResourcePrefix(value === "all" ? "" : value)}>
                <SelectTrigger size="sm" className="mt-2 h-10 w-full"><SelectValue placeholder={resourceLabel} /></SelectTrigger>
                <SelectContent>{RESOURCE_OPTIONS.map((option) => <SelectItem key={option.value || "all"} value={option.value || "all"}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="block min-w-0 text-sm">
              <span className="text-xs font-medium text-foreground">Action</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">What staff did</span>
              <Select value={actionPrefix || "all"} onValueChange={(value) => setActionPrefix(value === "all" ? "" : value)}>
                <SelectTrigger size="sm" className="mt-2 h-10 w-full"><SelectValue placeholder={actionLabel} /></SelectTrigger>
                <SelectContent>{ACTION_OPTIONS.map((option) => <SelectItem key={option.value || "all"} value={option.value || "all"}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <label className="block min-w-0 text-sm">
              <span className="text-xs font-medium text-foreground">Rows</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">Maximum results</span>
              <input type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 50)))} className="mt-2 box-border h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="text-xs font-medium text-foreground">From</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">Start of time window</span>
              <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-2 box-border h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="text-xs font-medium text-foreground">To</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">End of time window</span>
              <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="mt-2 box-border h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </label>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Filters apply when you select Apply filters.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={resetFilters}>
              Reset
            </Button>
          <Button
            variant="default"
            size="sm"
            type="button"
            onClick={() => load()}
            className="px-4 text-sm font-semibold"
          >
            Apply filters
          </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => downloadCsv()}
              disabled={!canExport}
              title={canExport ? "Export the filtered audit log as CSV" : "Your role cannot export audit logs"}
              aria-label={canExport ? "Export audit logs as CSV" : "Audit log export unavailable for your role"}
              className="px-4 text-sm font-semibold"
            >
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <AdminErrorState title="Audit log unavailable" detail={error} />
      ) : null}
      {!error && entries === null ? <AuditLogSkeleton /> : null}
      {!error && entries && entries.length === 0 ? (
        <AdminEmptyState
          title="No rows match"
          description="Adjust filters or widen the date range."
        />
      ) : null}
      {!error && entries && entries.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-outline-variant/20 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-xs uppercase tracking-widest text-on-surface-variant">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">By</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-outline-variant/10">
                  <td className="py-3 px-4 whitespace-nowrap text-on-surface-variant">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 max-w-[220px] break-words text-on-surface-variant">
                    {formatAuditActorLabel(e)}
                  </td>
                  <td
                    className="py-3 px-4 font-medium text-primary"
                    title={e.action || undefined}
                  >
                    {formatAuditActionLabel(e.action ?? "")}
                  </td>
                  <td
                    className="py-3 px-4 text-on-surface-variant"
                    title={e.resource || undefined}
                  >
                    {formatAuditResourceLabel(e.resource ?? null) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
