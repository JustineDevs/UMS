"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import type { AuditEntry } from "@/components/admin-console/AuditTimeline";
import { formatAuditActorLabel } from "@/lib/audit-actor-format";
import {
  formatAuditActionLabel,
  formatAuditResourceLabel,
} from "@/lib/audit-display-format";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from "@/components/admin-console";

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

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(500, Math.max(1, limit))));
    if (resourcePrefix.trim()) params.set("resource_prefix", resourcePrefix.trim());
    if (actionPrefix.trim()) params.set("action_prefix", actionPrefix.trim());
    if (from.trim()) params.set("from", new Date(from).toISOString());
    if (to.trim()) params.set("to", new Date(to).toISOString());

    setError(null);
    setEntries(null);
    fetch(`/api/admin/audit-logs?${params.toString()}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          setEntries([]);
          return;
        }
        setEntries((body.entries as AuditEntry[]) ?? []);
      })
      .catch(() => {
        setError("Unable to load audit logs");
        setEntries([]);
      });
  }, [resourcePrefix, actionPrefix, from, to, limit]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Resource prefix
          </span>
          <input
            value={resourcePrefix}
            onChange={(e) => setResourcePrefix(e.target.value)}
            className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
            placeholder="e.g. order:"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Action prefix
          </span>
          <input
            value={actionPrefix}
            onChange={(e) => setActionPrefix(e.target.value)}
            className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
            placeholder="e.g. staff_"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Limit
          </span>
          <input
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 50)}
            className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            From
          </span>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            To
          </span>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            Apply filters
          </button>
          {canExport ? (
            <button
              type="button"
              onClick={() => downloadCsv()}
              className="rounded border border-outline-variant/40 px-4 py-2 text-sm font-semibold text-primary"
            >
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <AdminErrorState title="Audit log unavailable" detail={error} />
      ) : null}
      {!error && entries === null ? (
        <AdminLoadingState label="Loading audit entries" />
      ) : null}
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
