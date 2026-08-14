"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from "@/components/admin-console";

type WorkflowRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  state: string;
  previous_state: string | null;
  notes: string | null;
  actor_email: string | null;
  updated_at: string;
};

const NEXT_STATES: Record<string, string[]> = { draft: ["pending_review", "published", "archived", "canceled"], pending_review: ["draft", "approved", "canceled"], approved: ["scheduled", "published", "draft"], scheduled: ["published", "draft", "canceled"], published: ["archived", "draft"], archived: ["draft"], failed: ["draft", "pending_review"] };

export function WorkflowQueueExplorer() {
  const [entityType, setEntityType] = useState("");
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState<WorkflowRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(200, Math.max(1, limit))));
    if (entityType.trim()) params.set("entity_type", entityType.trim());

    setError(null);
    setRows(null);
    fetch(`/api/admin/workflow/entities?${params.toString()}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          setRows([]);
          return;
        }
        setRows((body.rows as WorkflowRow[]) ?? []);
      })
      .catch(() => {
        setError("Unable to load workflow data");
        setRows([]);
      });
  }, [entityType, limit]);

  useEffect(() => {
    load();
  }, [load]);

  async function transition(row: WorkflowRow, toState: string) {
    setTransitioning(row.id);
    setError(null);
    const response = await fetch("/api/admin/workflow/transition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity_type: row.entity_type, entity_id: row.entity_id, to_state: toState }) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "Workflow transition failed");
    } else load();
    setTransitioning(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Entity type
          </span>
          <input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
            placeholder="e.g. catalog_product"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Limit
          </span>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 50)}
            className="mt-1 w-full rounded border border-outline-variant/30 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            Apply filters
          </button>
        </div>
      </div>

      {rows === null && !error ? (
        <AdminLoadingState label="Loading workflow state" />
      ) : null}
      {error ? (
        <AdminErrorState title="Workflow data unavailable" detail={error} />
      ) : null}
      {!error && rows && rows.length === 0 ? (
        <AdminEmptyState
          title="No workflow rows yet"
          description="Publishing or catalog actions that write to admin_entity_workflow will appear here."
        />
      ) : null}
      {!error && rows && rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Previous</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-outline-variant/15 hover:bg-surface-container-low/60"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-xs text-on-surface">{row.entity_type}</div>
                      <div className="mt-1 max-w-[240px] truncate font-mono text-[11px] text-on-surface-variant">
                        {row.entity_id}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-on-surface">{row.state}</td>
                    <td className="px-4 py-3 align-top text-on-surface-variant">
                      {row.previous_state ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-on-surface-variant">
                      {row.actor_email ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-on-surface-variant">
                      {new Date(row.updated_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 align-top"><div className="flex flex-wrap gap-1">{(NEXT_STATES[row.state] ?? []).slice(0, 2).map((next) => <Button key={next} size="sm" variant="outline" disabled={transitioning === row.id} onClick={() => void transition(row, next)}>{next.replace(/_/g, " ")}</Button>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-on-surface-variant">
            State changes run on the server. Invalid moves are rejected with a clear error.
          </p>
        </>
      ) : null}
    </div>
  );
}
