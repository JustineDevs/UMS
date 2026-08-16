"use client";

import type { CmsBlock } from "@universal-music-store/platform-data";
import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { useCallback, useEffect, useState } from "react";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";
import { cmsMutationHeaders } from "@/lib/cms-mutation-headers";
import { CmsPageBlocksEditor } from "./CmsPageBlocksEditor";

type Row = {
  id: string;
  collection_handle: string;
  locale: string;
  intro_html: string;
  banner_url: string | null;
  blocks: CmsBlock[];
};

type CatOpt = { id: string; name: string; handle: string };

export function CmsCategoryEditor() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(
    session?.user?.permissions ?? [],
    "content:write",
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [categories, setCategories] = useState<CatOpt[]>([]);
  const [gaps, setGaps] = useState<CatOpt[]>([]);
  const [gapLocale, setGapLocale] = useState("en");

  const siteBase = getStorefrontPublicOrigin();

  const load = useCallback(() => {
    setLoadingRows(true);
    setError(null);
    fetch("/api/admin/cms/category-content")
      .then(async (r) => {
        const j = (await r.json()) as { data?: Row[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.data ?? [];
      })
      .then((list) =>
        setRows(
          list.map((r) => ({
            ...r,
            blocks: Array.isArray(r.blocks) ? (r.blocks as CmsBlock[]) : [],
          })),
        ),
      )
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load content"),
      )
      .finally(() => setLoadingRows(false));
  }, []);

  const loadCategories = useCallback(() => {
    void fetch("/api/admin/cms/category-content/medusa-categories")
      .then(async (r) => {
        const j = (await r.json()) as { categories?: CatOpt[] };
        if (!r.ok) return;
        setCategories(j.categories ?? []);
      })
      .catch(() => setCategories([]));
  }, []);

  const loadGaps = useCallback(() => {
    void fetch(
      `/api/admin/cms/category-content/catalog-gaps?locale=${encodeURIComponent(gapLocale)}`,
    )
      .then(async (r) => {
        const j = (await r.json()) as { data?: { missing?: CatOpt[] } };
        if (!r.ok) return;
        setGaps(j.data?.missing ?? []);
      })
      .catch(() => setGaps([]));
  }, [gapLocale]);

  useEffect(() => {
    load();
    loadCategories();
  }, [load, loadCategories]);

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  const save = async () => {
    if (!editing || !canWrite) return;
    setError(null);
    const r = await fetch("/api/admin/cms/category-content", {
      method: "POST",
      headers: cmsMutationHeaders(),
      body: JSON.stringify({
        id: editing.id || undefined,
        collection_handle: editing.collection_handle,
        locale: editing.locale,
        intro_html: editing.intro_html,
        banner_url: editing.banner_url,
        blocks: editing.blocks,
      }),
    });
    const j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setError(j.error ?? "Unable to save");
      return;
    }
    setEditing(null);
    load();
    loadGaps();
  };

  if (status === "loading")
    return <p className="text-sm text-slate-600">Loading…</p>;

  const previewCollection =
    siteBase && editing
      ? `${siteBase}/collections/${encodeURIComponent(editing.collection_handle)}?locale=${encodeURIComponent(editing.locale)}`
      : "";
  const previewShopFallback =
    siteBase && editing
      ? `${siteBase}/shop?category=${encodeURIComponent(editing.collection_handle)}&locale=${encodeURIComponent(editing.locale)}`
      : "";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h3 className="font-headline text-lg font-bold text-primary mb-3">
          Rows
        </h3>
        {error ? <p className="text-sm text-red-700 mb-2">{error}</p> : null}

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm">
          <p className="font-semibold text-amber-950">
            Missing CMS rows (catalog has category, no CMS row)
          </p>
          <label className="mt-2 block text-xs text-amber-900">
            Locale
            <select
              className="ml-2 rounded border border-amber-300 px-2 py-1 text-sm"
              value={gapLocale}
              onChange={(e) => setGapLocale(e.target.value)}
            >
              <option value="en">en</option>
            </select>
          </label>
          <ul className="mt-2 max-h-32 list-inside list-disc text-xs text-amber-950">
            {gaps.length === 0 ? (
              <li>None detected for this locale.</li>
            ) : (
              gaps.map((c) => (
                <li key={c.id}>
                  {c.name} (<code>{c.handle}</code>)
                </li>
              ))
            )}
          </ul>
        </div>

        {loadingRows ? (
          <p className="text-sm text-slate-600">Loading category rows...</p>
        ) : null}
        {!loadingRows && rows.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            No category content rows exist yet.
          </p>
        ) : null}
        <ul className="space-y-2" aria-label="Category content rows">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="text-sm underline"
                onClick={() => setEditing(r)}
              >
                {r.collection_handle} ({r.locale})
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-4 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          onClick={() =>
            setEditing({
              id: "",
              collection_handle: categories[0]?.handle ?? "",
              locale: "en",
              intro_html: "",
              banner_url: null,
              blocks: [],
            })
          }
        >
          New row
        </button>
      </div>
      {editing ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <label className="block text-xs font-medium text-slate-600">
            Collection (Medusa product category)
            <select
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.collection_handle}
              onChange={(e) => {
                const h = e.target.value;
                setEditing({ ...editing, collection_handle: h });
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.handle}>
                  {c.name} ({c.handle})
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-600">
            Handle must match the Medusa product category. Preview:{" "}
            {previewCollection ? (
              <>
                <a
                  href={previewCollection}
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  /collections/{editing.collection_handle}
                </a>
                {" · "}
                <a
                  href={previewShopFallback}
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  shop filter
                </a>
              </>
            ) : (
              "Storefront URL unavailable"
            )}
            . Index:{" "}
            {siteBase ? (
              <a
                href={`${siteBase}/collections`}
                className="text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                /collections
              </a>
            ) : (
              "Storefront URL unavailable"
            )}
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Locale
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.locale}
              onChange={(e) =>
                setEditing({ ...editing, locale: e.target.value })
              }
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Intro HTML
            <textarea
              className="mt-1 w-full min-h-[100px] rounded border border-slate-200 px-3 py-2 text-sm font-mono"
              value={editing.intro_html}
              onChange={(e) =>
                setEditing({ ...editing, intro_html: e.target.value })
              }
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Banner URL
            <input
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={editing.banner_url ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, banner_url: e.target.value || null })
              }
            />
          </label>
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Blocks</p>
            <CmsPageBlocksEditor
              value={editing.blocks}
              onChange={(blocks) => setEditing({ ...editing, blocks })}
              disabled={!canWrite}
            />
          </div>
          <button
            type="button"
            disabled={!canWrite || !editing.collection_handle.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}
