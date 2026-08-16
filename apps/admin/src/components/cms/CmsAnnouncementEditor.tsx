"use client";

import { staffHasPermission, type CmsAnnouncementRow } from "@universal-music-store/platform-data";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cmsMutationHeaders } from "@/lib/cms-mutation-headers";

const CHAR_WARN = 280;

type AnalyticsMap = Record<string, { impressions: number; clicks: number; dismisses: number }>;

function analyticsKey(row: Pick<CmsAnnouncementRow, "id" | "locale">) {
  return `${row.id}:${row.locale}`;
}

function plainTextLength(body: string, format: CmsAnnouncementRow["bodyFormat"]) {
  if (format !== "html") return body.length;
  return body.replace(/<[^>]+>/g, "").length;
}

export function CmsAnnouncementEditor() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(session?.user?.permissions ?? [], "content:write");
  const [rows, setRows] = useState<CmsAnnouncementRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsMap>({});
  const [editing, setEditing] = useState<CmsAnnouncementRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/cms/announcement")
      .then(async (r) => {
        const j = (await r.json()) as {
          data?: { rows: CmsAnnouncementRow[]; analytics: AnalyticsMap };
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.data;
      })
      .then((d) => {
        const nextRows = d?.rows ?? [];
        setRows(nextRows);
        setAnalytics(d?.analytics ?? {});
        setEditing((prev) => {
          if (!nextRows.length) return null;
          if (prev && nextRows.some((r) => r.id === prev.id && r.locale === prev.locale)) return prev;
          return nextRows[0] ?? null;
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load content"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const warnLen = useMemo(
    () => (editing ? plainTextLength(editing.body, editing.bodyFormat) : 0),
    [editing],
  );

  const save = async () => {
    if (!editing || !canWrite) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/cms/announcement", {
        method: "PUT",
        headers: cmsMutationHeaders(),
        body: JSON.stringify({
          id: editing.id,
          locale: editing.locale,
          body: editing.body,
          bodyFormat: editing.bodyFormat,
          linkUrl: editing.linkUrl,
          linkLabel: editing.linkLabel,
          dismissible: editing.dismissible,
          startsAt: editing.startsAt,
          endsAt: editing.endsAt,
          priority: editing.priority,
          stackGroup: editing.stackGroup,
          regionCode: editing.regionCode,
        }),
      });
      const j = (await r.json()) as { error?: string; data?: { rows: CmsAnnouncementRow[] } };
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      if (j.data?.rows) {
        setRows(j.data.rows);
        const next = j.data.rows.find((x) => x.id === editing.id && x.locale === editing.locale);
        if (next) setEditing(next);
      } else load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || !canWrite) return;
    if (!window.confirm(`Delete announcement "${editing.id}" (${editing.locale})?`)) return;
    setError(null);
    const r = await fetch(
      `/api/admin/cms/announcement?id=${encodeURIComponent(editing.id)}&locale=${encodeURIComponent(editing.locale)}`,
      { method: "DELETE", headers: cmsMutationHeaders() },
    );
    const j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setError(j.error ?? "Delete failed");
      return;
    }
    setEditing(null);
    load();
  };

  if (status === "loading") return <p className="text-sm text-slate-600">Loading…</p>;

  const ax = editing ? analytics[analyticsKey(editing)] : undefined;

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-4">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            onClick={() => load()}
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={!canWrite}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            onClick={() =>
              setEditing({
                id: `bar-${crypto.randomUUID().slice(0, 8)}`,
                locale: "en",
                body: "",
                bodyFormat: "plain",
                linkUrl: null,
                linkLabel: null,
                dismissible: true,
                startsAt: null,
                endsAt: null,
                priority: 0,
                stackGroup: null,
                regionCode: null,
              })
            }
          >
            New bar
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Same <span className="font-mono">stack group</span> shows one bar (highest priority). Empty
          group stacks each id separately. Optional <span className="font-mono">region</span> filters
          when the storefront sends a region code later.
        </p>
        <ul className="space-y-1 border border-slate-200 rounded-lg divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={`${r.id}:${r.locale}`}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  editing?.id === r.id && editing?.locale === r.locale ? "bg-primary/5 font-medium" : ""
                }`}
                onClick={() => setEditing(r)}
              >
                {r.id} · {r.locale} · p{r.priority}
                {r.stackGroup ? ` · group:${r.stackGroup}` : ""}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Live preview (storefront breakpoints)</p>
            <div className="mx-auto w-full max-w-[360px] border border-dashed border-slate-300 bg-white sm:max-w-[640px] md:max-w-[768px]">
              <div className="w-full border-b border-primary/15 bg-primary/5 px-4 py-2 text-center text-xs text-primary sm:text-sm">
                {editing.bodyFormat === "html" ? (
                  <span
                    className="font-body inline-block max-w-full [&_a]:underline"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeCmsHtml(editing.body || "…"),
                    }}
                  />
                ) : (
                  <span className="font-body">{editing.body || "…"}</span>
                )}
              </div>
            </div>
          </div>

          {ax ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <span className="font-semibold">Analytics</span>: impressions {ax.impressions}, clicks{" "}
              {ax.clicks}, dismisses {ax.dismisses}
              {!editing.dismissible ? " (not dismissible)" : ""}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No analytics rows yet for this bar.</p>
          )}

          <label className="block text-xs font-medium text-slate-600">
            Bar id
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono"
              value={editing.id}
              onChange={(e) => setEditing({ ...editing, id: e.target.value })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Locale
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.locale}
              onChange={(e) => setEditing({ ...editing, locale: e.target.value })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Body format
            <select
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.bodyFormat}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  bodyFormat: e.target.value === "html" ? "html" : "plain",
                })
              }
            >
              <option value="plain">Plain text</option>
              <option value="html">HTML (trusted staff content)</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Message
            <textarea
              className="mt-1 w-full min-h-[80px] rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            />
            {warnLen > CHAR_WARN ? (
              <span className="mt-1 block text-amber-800">
                Text is long ({warnLen} chars). The bar may wrap; consider shortening for small screens.
              </span>
            ) : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-600">
              Priority
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={editing.priority}
                onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Stack group (optional)
              <input
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={editing.stackGroup ?? ""}
                onChange={(e) => setEditing({ ...editing, stackGroup: e.target.value || null })}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            Region code (optional)
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.regionCode ?? ""}
              placeholder="e.g. PH"
              onChange={(e) => setEditing({ ...editing, regionCode: e.target.value || null })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Link URL
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.linkUrl ?? ""}
              onChange={(e) => setEditing({ ...editing, linkUrl: e.target.value || null })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Link label
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.linkLabel ?? ""}
              onChange={(e) => setEditing({ ...editing, linkLabel: e.target.value || null })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.dismissible}
              onChange={(e) => setEditing({ ...editing, dismissible: e.target.checked })}
            />
            Dismissible
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Starts at (ISO)
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.startsAt ?? ""}
              onChange={(e) => setEditing({ ...editing, startsAt: e.target.value || null })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Ends at (ISO)
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.endsAt ?? ""}
              onChange={(e) => setEditing({ ...editing, endsAt: e.target.value || null })}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canWrite || saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={!canWrite}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-800 disabled:opacity-50"
              onClick={() => void remove()}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Select a bar or create one.</p>
      )}
    </div>
  );
}
