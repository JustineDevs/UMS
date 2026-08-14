"use client";

import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { sanitizeSameOriginUrl } from "@universal-music-store/sdk";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  active: boolean;
  preserve_query: boolean;
};

export function CmsRedirectsManager() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(
    session?.user?.permissions ?? [],
    "content:write",
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [preserveQuery, setPreserveQuery] = useState(false);
  const [testPath, setTestPath] = useState("/");
  const [testResult, setTestResult] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);

  const load = useCallback(() => {
    setLoadingRows(true);
    setError(null);
    fetch("/api/admin/cms/redirects")
      .then(async (r) => {
        const j = (await r.json()) as { data?: Row[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.data ?? [];
      })
      .then(setRows)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load content"),
      )
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!canWrite) return;
    if (!fromPath.trim() || !toPath.trim()) {
      setError("From and To paths are required.");
      return;
    }
    setError(null);
    const r = await fetch("/api/admin/cms/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_path: fromPath.trim(),
        to_path: toPath.trim(),
        status_code: 301,
        active: true,
        preserve_query: preserveQuery,
      }),
    });
    const j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setError(j.error ?? "Failed");
      return;
    }
    load();
  };

  const remove = async (id: string) => {
    if (!canWrite || !confirm("Delete redirect?")) return;
    await fetch(`/api/admin/cms/redirects/${id}`, { method: "DELETE" });
    load();
  };

  const runTest = async () => {
    setTestResult("");
    const r = await fetch(
      `/api/admin/cms/redirects/resolve?path=${encodeURIComponent(testPath)}`,
    );
    const j = (await r.json()) as { data?: unknown; error?: string };
    if (!r.ok) {
      setTestResult(j.error ?? "Error");
      return;
    }
    setTestResult(JSON.stringify(j.data, null, 2));
  };

  const exportCsv = () => {
    const url = sanitizeSameOriginUrl("/api/admin/cms/redirects/export", window.location.origin);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const importCsv = async (file: File | null) => {
    if (!file || !canWrite) return;
    setError(null);
    const text = await file.text();
    const r = await fetch("/api/admin/cms/redirects/import", {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    const j = (await r.json()) as {
      data?: { imported: number; warnings: string[] };
      error?: string;
    };
    if (!r.ok) {
      setError(j.error ?? "Import failed");
      return;
    }
    setTestResult(
      `Imported ${j.data?.imported ?? 0}. Warnings:\n${(j.data?.warnings ?? []).join("\n")}`,
    );
    load();
  };

  const bulkActive = async (active: boolean) => {
    if (!canWrite) return;
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!ids.length) return;
    const r = await fetch("/api/admin/cms/redirects/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, active }),
    });
    const j = (await r.json()) as { error?: string };
    if (!r.ok) setError(j.error ?? "Bulk update failed");
    setSelected({});
    load();
  };

  if (status === "loading")
    return <p className="text-sm text-slate-600">Loading…</p>;
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="max-w-4xl space-y-8">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Test resolver</h3>
        <p className="text-xs text-slate-600">
          Enter a storefront path. Response includes chain, loops, and duplicate
          from_path warnings from the full table.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            value={testPath}
            onChange={(e) => setTestPath(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            onClick={() => void runTest()}
          >
            Resolve
          </button>
        </div>
        {testResult ? (
          <pre className="max-h-56 overflow-auto rounded bg-slate-50 p-3 text-xs">
            {testResult}
          </pre>
        ) : null}
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          onClick={() => exportCsv()}
        >
          Export CSV
        </button>
        <label className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm cursor-pointer">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={!canWrite}
            onChange={(e) => void importCsv(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          disabled={!canWrite || selectedCount === 0}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => void bulkActive(true)}
        >
          Enable selected
        </button>
        <button
          type="button"
          disabled={!canWrite || selectedCount === 0}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => void bulkActive(false)}
        >
          Disable selected
        </button>
      </section>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs font-medium text-slate-600">
          From
          <input
            className="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm"
            value={fromPath}
            onChange={(e) => setFromPath(e.target.value)}
            placeholder="/old-path"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To
          <input
            className="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm"
            value={toPath}
            onChange={(e) => setToPath(e.target.value)}
            placeholder="/new-path"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={preserveQuery}
            onChange={(e) => setPreserveQuery(e.target.checked)}
          />
          Preserve query string
        </label>
        <button
          type="button"
          disabled={!canWrite || !fromPath.trim() || !toPath.trim()}
          className="rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => void add()}
        >
          Add
        </button>
      </div>

      {loadingRows ? (
        <p className="text-sm text-slate-600">Loading redirects...</p>
      ) : null}
      {!loadingRows && rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No redirects have been configured.
        </p>
      ) : null}
      <ul className="space-y-2 text-sm" aria-label="Redirect rules">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2"
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(selected[r.id])}
                onChange={(e) =>
                  setSelected((s) => ({ ...s, [r.id]: e.target.checked }))
                }
              />
              <span>
                <code>{r.from_path}</code> → <code>{r.to_path}</code> (
                {r.status_code}){r.active ? "" : " · off"}
                {r.preserve_query ? " · +query" : ""}
              </span>
            </label>
            <button
              type="button"
              className="text-red-700 text-xs underline"
              onClick={() => void remove(r.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
