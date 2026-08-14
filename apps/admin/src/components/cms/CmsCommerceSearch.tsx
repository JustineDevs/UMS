"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { useCallback, useEffect, useState } from "react";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";

type ProductRow = {
  id: string;
  title: string;
  handle: string;
  sku: string;
  status: string;
  thumbnail_url: string | null;
  category_ids: string[];
};

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export function CmsCommerceSearch() {
  const { data: session, status } = useSession();
  const canRead =
    staffHasPermission(session?.user?.permissions ?? [], "content:read") ||
    staffHasPermission(session?.user?.permissions ?? [], "catalog:read");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [published, setPublished] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<
    { id: string; name: string; handle: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const siteBase = getStorefrontPublicOrigin();

  const loadCategories = useCallback(() => {
    void fetch("/api/admin/catalog/categories")
      .then(async (r) => {
        const j = (await r.json()) as {
          categories?: { id: string; name: string; handle: string }[];
        };
        if (!r.ok) return;
        setCategories(j.categories ?? []);
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const search = async () => {
    if (!canRead) return;
    setError(null);
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (categoryId.trim()) params.set("category_id", categoryId.trim());
    if (published) params.set("published", published);
    params.set("limit", "60");
    try {
      const r = await fetch(
        `/api/admin/commerce/products/lookup?${params.toString()}`,
      );
      const j = (await r.json()) as {
        data?: { products: ProductRow[] };
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      setRows(j.data?.products ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lookup failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading")
    return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div className="max-w-5xl space-y-4">
      <p className="text-sm text-slate-600">
        Table uses the live Medusa catalog. Links open the staff product editor
        and storefront PDP.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">
          Search
          <input
            className="mt-1 block min-w-[200px] rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, SKU, keyword"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Category
          <select
            className="mt-1 block min-w-[160px] rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Any</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.handle})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Published
          <select
            className="mt-1 block rounded border border-slate-200 px-2 py-1.5 text-sm"
            value={published}
            onChange={(e) => setPublished(e.target.value)}
          >
            <option value="">Any</option>
            <option value="1">Published</option>
            <option value="0">Not published</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!canRead || loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => void search()}
        >
          {loading ? "Loading…" : "Search"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">
                Thumb
              </th>
              <th scope="col" className="px-3 py-2">
                Title
              </th>
              <th scope="col" className="px-3 py-2">
                SKU
              </th>
              <th scope="col" className="px-3 py-2">
                Handle
              </th>
              <th scope="col" className="px-3 py-2">
                Id
              </th>
              <th scope="col" className="px-3 py-2">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                Links
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  No results. Run a search.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    {p.thumbnail_url ? (
                      <Image
                        src={p.thumbnail_url}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td
                    className="max-w-[200px] truncate px-3 py-2"
                    title={p.title}
                  >
                    {p.title}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <span className="mr-1">{p.sku || "—"}</span>
                    {p.sku ? (
                      <button
                        type="button"
                        className="text-primary underline"
                        aria-label={`Copy SKU ${p.sku}`}
                        onClick={() => copyText(p.sku)}
                      >
                        Copy
                      </button>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.handle}{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      aria-label={`Copy handle ${p.handle}`}
                      onClick={() => copyText(p.handle)}
                    >
                      Copy
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.id.slice(0, 12)}…{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      aria-label={`Copy product id ${p.id}`}
                      onClick={() => copyText(p.id)}
                    >
                      Copy
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs">{p.status}</td>
                  <td className="space-y-1 px-3 py-2 text-xs">
                    <a
                      href={`/admin/catalog/${p.id}`}
                      className="block text-primary underline"
                    >
                      Admin product
                    </a>
                    {sanitizeTrustedPublicUrl(`${siteBase}/shop/${encodeURIComponent(p.handle)}`, [siteBase]) ? <a
                      href={sanitizeTrustedPublicUrl(`${siteBase}/shop/${encodeURIComponent(p.handle)}`, [siteBase]) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-primary underline"
                    >
                      Storefront PDP
                    </a> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
