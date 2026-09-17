"use client";

import { useEffect, useState } from "react";
import { formatAuditActorLabel } from "@/lib/audit-actor-format";
import {
  formatAuditActionLabel,
  formatAuditResourceLabel,
} from "@/lib/audit-display-format";

export type AuditEntry = {
  id: string;
  action: string;
  resource: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_id?: string | null;
  /** Joined from `users` when the API selects `users(email,name)`. */
  users?: { email?: string | null; name?: string | null } | null;
};

export function AuditTimeline({
  resourcePrefix,
  title = "Activity",
  className = "",
}: {
  /** e.g. `product:` to match audit resource */
  resourcePrefix?: string;
  title?: string;
  className?: string;
}) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: "20" });
    if (resourcePrefix) params.set("resource_prefix", resourcePrefix);
    fetch(`/api/admin/audit-logs?${params.toString()}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as {
          error?: string;
          entries?: AuditEntry[];
        };
        if (cancelled) return;
        if (!r.ok) {
          setError(
            r.status === 403
              ? "Activity feed is not available for your role."
              : (body.error ?? "Activity feed unavailable"),
          );
          setEntries([]);
          return;
        }
        if (body.error) {
          setError(body.error);
          setEntries([]);
          return;
        }
        setEntries(body.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Activity feed unavailable");
          setEntries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resourcePrefix]);

  return (
    <div className={`rounded-[var(--admin-card-radius)] border border-border bg-card p-4 shadow-xs ${className}`}>
      <h3 className="font-heading text-sm font-medium tracking-tight text-foreground">{title}</h3>
      {error ? (
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      ) : null}
      {entries === null ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto text-xs">
          {entries.map((e) => (
            <li key={e.id} className="border-b border-border/60 pb-2 last:border-0">
              <p className="font-medium text-foreground">
                {formatAuditActionLabel(e.action)}
              </p>
              {e.resource ? (
                <p className="text-muted-foreground">
                  {formatAuditResourceLabel(e.resource)}
                </p>
              ) : null}
              <p className="text-[10px] text-muted-foreground/80">
                By {formatAuditActorLabel(e)} · {new Date(e.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
