"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { useCallback, useEffect, useState } from "react";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";
import { cmsMutationHeaders } from "@/lib/cms-mutation-headers";

type Post = {
  id: string;
  slug: string;
  title: string;
  status: string;
  locale?: string;
};

export function CmsBlogManager() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(
    session?.user?.permissions ?? [],
    "content:write",
  );
  const [rows, setRows] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoadingRows(true);
    setError(null);
    fetch("/api/admin/cms/blog")
      .then(async (r) => {
        const j = (await r.json()) as { data?: Post[]; error?: string };
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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const exportHref =
    selected.size > 0
      ? `/api/admin/cms/blog/export?ids=${encodeURIComponent(Array.from(selected).join(","))}`
      : "/api/admin/cms/blog/export";
  const storefrontOrigin = getStorefrontPublicOrigin();

  if (status === "loading")
    return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-sm text-slate-600">
        Draft and publish posts. Use Edit for the in-admin editor, scheduling,
        SEO fields, and preview links.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href={exportHref}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          download
        >
          Export CSV{selected.size ? ` (${selected.size})` : " (all)"}
        </a>
        <button
          type="button"
          disabled={!canWrite || selected.size === 0}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-800 disabled:opacity-50"
          onClick={async () => {
            if (!confirm(`Delete ${selected.size} post(s)?`)) return;
            const r = await fetch("/api/admin/cms/blog/bulk", {
              method: "POST",
              headers: cmsMutationHeaders(),
              body: JSON.stringify({ ids: Array.from(selected) }),
            });
            if (r.ok) {
              setSelected(new Set());
              load();
            } else setError("Bulk delete failed");
          }}
        >
          Delete selected
        </button>
      </div>
      {loadingRows ? (
        <p className="text-sm text-slate-600">Loading posts...</p>
      ) : null}
      {!loadingRows && rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No blog posts exist yet.
        </p>
      ) : null}
      <ul className="space-y-2" aria-label="Blog posts">
        {rows.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-4 py-2"
          >
            <label className="flex flex-1 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="rounded border-slate-300"
              />
              <span>
                {p.title} <span className="text-slate-500">({p.status})</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link
                href={`/admin/cms/blog/${p.id}`}
                className="text-primary underline"
              >
                Edit
              </Link>
              <a
                href={`${storefrontOrigin}/blog/${encodeURIComponent(p.slug)}`}
                className="text-primary underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                View storefront
              </a>
            </div>
          </li>
        ))}
      </ul>
      {canWrite ? (
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            const slug = `draft-${Date.now()}`;
            const r = await fetch("/api/admin/cms/blog", {
              method: "POST",
              headers: cmsMutationHeaders(),
              body: JSON.stringify({
                slug,
                title: "New draft",
                locale: "en",
                status: "draft",
              }),
            });
            const j = (await r.json()) as {
              data?: { id: string };
              error?: string;
            };
            if (r.ok && j.data?.id) {
              window.location.href = `/admin/cms/blog/${j.data.id}`;
            } else setError(j.error ?? "Could not create");
          }}
        >
          New post
        </button>
      ) : null}
    </div>
  );
}
