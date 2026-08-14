"use client";

import {
  CMS_FORM_KEYS,
  staffHasPermission,
} from "@universal-music-store/platform-data";
import { useSession } from "next-auth/react";
import { Fragment, useCallback, useEffect, useState } from "react";

type Sub = {
  id: string;
  form_key: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  assigned_to: string | null;
  spam_score: number;
};

function PayloadPretty({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload);
  if (entries.length === 0)
    return <p className="text-xs text-slate-500">Empty</p>;
  return (
    <dl className="grid gap-2 text-xs">
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="rounded border border-slate-100 bg-slate-50/80 px-2 py-1"
        >
          <dt className="font-medium text-slate-700">{k}</dt>
          <dd className="mt-0.5 break-all font-mono text-slate-600">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CmsFormsTable() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(
    session?.user?.permissions ?? [],
    "content:write",
  );
  const [rows, setRows] = useState<Sub[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [formKey, setFormKey] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");

  const loadSettings = useCallback(() => {
    void fetch("/api/admin/cms/forms/settings")
      .then(async (r) => {
        const j = (await r.json()) as {
          data?: { webhook_url: string | null; notify_email: string | null };
        };
        if (!r.ok) return;
        const d = j.data;
        if (d) {
          setWebhookUrl(d.webhook_url ?? "");
          setNotifyEmail(d.notify_email ?? "");
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoadingRows(true);
    setError(null);
    const sp = new URLSearchParams();
    sp.set("limit", String(limit));
    sp.set("offset", String(offset));
    if (formKey.trim()) sp.set("form_key", formKey.trim());
    if (from.trim()) sp.set("from", from.trim());
    if (to.trim()) sp.set("to", to.trim());
    fetch(`/api/admin/cms/forms/submissions?${sp.toString()}`)
      .then(async (r) => {
        const j = (await r.json()) as {
          data?: Sub[];
          meta?: { total?: number };
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        setRows(j.data ?? []);
        setTotal(
          typeof j.meta?.total === "number"
            ? j.meta.total
            : (j.data?.length ?? 0),
        );
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load content"),
      )
      .finally(() => setLoadingRows(false));
  }, [formKey, from, to, limit, offset]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string, read: boolean) => {
    const r = await fetch(`/api/admin/cms/forms/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_at: read ? new Date().toISOString() : null }),
    });
    if (r.ok) load();
  };

  const assign = async (id: string, assigned_to: string) => {
    const r = await fetch(`/api/admin/cms/forms/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: assigned_to.trim() || null }),
    });
    if (r.ok) load();
  };

  const saveSettings = async () => {
    const r = await fetch("/api/admin/cms/forms/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook_url: webhookUrl.trim() || null,
        notify_email: notifyEmail.trim() || null,
      }),
    });
    if (r.ok) loadSettings();
    else setError("Settings save failed");
  };

  const exportHref = () => {
    const sp = new URLSearchParams();
    if (formKey.trim()) sp.set("form_key", formKey.trim());
    if (from.trim()) sp.set("from", from.trim());
    if (to.trim()) sp.set("to", to.trim());
    return `/api/admin/cms/forms/submissions/export?${sp.toString()}`;
  };

  if (status === "loading")
    return <p className="text-sm text-slate-600">Loading…</p>;

  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm">
        <h3 className="font-semibold text-slate-900">Delivery and spam</h3>
        <p className="mt-2 text-xs text-slate-600">
          Storefront POST{" "}
          <code className="rounded bg-white px-1">/api/forms/[formKey]</code> is
          rate-limited to 20 requests per minute per IP. Honeypot fields{" "}
          <code className="rounded bg-white px-1">_hp</code> or{" "}
          <code className="rounded bg-white px-1">_honeypot</code> must stay
          empty or the submission is accepted silently without storing (bots).
        </p>
        <p className="mt-2 text-xs text-slate-600">
          When{" "}
          <code className="rounded bg-white px-1">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          is set on the storefront, successful inserts trigger a JSON POST to
          the webhook URL below.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-700">
            Webhook URL
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={!canWrite}
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Notify email (stored; wire your mailer to this address if needed)
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              disabled={!canWrite}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={!canWrite}
          className="mt-3 rounded bg-primary px-3 py-1.5 text-xs text-white disabled:opacity-50"
          onClick={() => void saveSettings()}
        >
          Save notification settings
        </button>
      </section>

      <section className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          Form key
          <select
            className="mt-1 block rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={formKey}
            onChange={(e) => {
              setOffset(0);
              setFormKey(e.target.value);
            }}
          >
            <option value="">All</option>
            {CMS_FORM_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          From (ISO)
          <input
            className="mt-1 block rounded border border-slate-200 px-2 py-1.5 text-sm font-mono"
            value={from}
            onChange={(e) => {
              setOffset(0);
              setFrom(e.target.value);
            }}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To (ISO)
          <input
            className="mt-1 block rounded border border-slate-200 px-2 py-1.5 text-sm font-mono"
            value={to}
            onChange={(e) => {
              setOffset(0);
              setTo(e.target.value);
            }}
          />
        </label>
        <a
          href={exportHref()}
          className="rounded border border-slate-200 px-3 py-1.5 text-sm"
          download
        >
          Export CSV
        </a>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="py-2 pr-4">
                When
              </th>
              <th scope="col" className="py-2 pr-4">
                Form
              </th>
              <th scope="col" className="py-2 pr-4">
                Spam
              </th>
              <th scope="col" className="py-2 pr-4">
                Read
              </th>
              <th scope="col" className="py-2">
                Payload
              </th>
            </tr>
          </thead>
          <tbody>
            {loadingRows ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-sm text-slate-600"
                >
                  Loading submissions...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-sm text-slate-600"
                >
                  No form submissions match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{r.form_key}</td>
                    <td className="py-2 pr-4 text-xs">{r.spam_score}</td>
                    <td className="py-2 pr-4 text-xs">
                      {r.read_at ? "yes" : "no"}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-primary underline text-xs"
                        onClick={() =>
                          setExpanded(expanded === r.id ? null : r.id)
                        }
                      >
                        {expanded === r.id ? "Collapse" : "Expand"}
                      </button>
                      {expanded !== r.id ? (
                        <span className="ml-2 font-mono text-[10px] text-slate-500 break-all line-clamp-2">
                          {JSON.stringify(r.payload)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                  {expanded === r.id ? (
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <td colSpan={5} className="px-4 py-3">
                        <PayloadPretty payload={r.payload} />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!canWrite}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                            onClick={() => void markRead(r.id, !r.read_at)}
                          >
                            {r.read_at ? "Mark unread" : "Mark read"}
                          </button>
                          <label className="flex items-center gap-1 text-xs">
                            Assign
                            <input
                              defaultValue={r.assigned_to ?? ""}
                              disabled={!canWrite}
                              className="w-40 rounded border border-slate-200 px-1 py-0.5 font-mono text-[11px]"
                              onBlur={(e) => void assign(r.id, e.target.value)}
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-600">
          {total} total · page {page} / {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50"
            disabled={offset <= 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
