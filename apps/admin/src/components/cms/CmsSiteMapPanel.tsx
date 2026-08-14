"use client";

import type {
  CmsNavLink,
  CmsNavigationPayload,
} from "@universal-music-store/platform-data";
import { useCallback, useEffect, useMemo, useState } from "react";

type PageRow = {
  id: string;
  slug: string;
  locale: string;
  status: string;
  parent_slug: string | null;
  title: string;
};

type EnrichedRow = PageRow & {
  linked: boolean;
  brokenParent: boolean;
  notes: string;
};

function visitNavLinks(links: CmsNavLink[], acc: Set<string>) {
  for (const L of links) {
    acc.add(L.href);
    if (L.featured?.href) acc.add(L.featured.href);
    if (L.children?.length) visitNavLinks(L.children, acc);
  }
}

function collectNavHrefs(nav: CmsNavigationPayload): Set<string> {
  const acc = new Set<string>();
  visitNavLinks(nav.headerLinks, acc);
  visitNavLinks(nav.headerLinksMobile, acc);
  visitNavLinks(nav.footerBottomLinks, acc);
  for (const col of nav.footerColumns) {
    visitNavLinks(col.links, acc);
  }
  for (const s of nav.socialLinks) {
    acc.add(s.href);
  }
  return acc;
}

function hrefMentionsCmsSlug(href: string, slug: string): boolean {
  const needle = `/p/${slug}`;
  const t = href.trim();
  if (!t) return false;
  if (t === needle || t.startsWith(`${needle}?`) || t.startsWith(`${needle}#`))
    return true;
  try {
    const u = new URL(t, "https://placeholder.local");
    return (
      u.pathname === needle || u.pathname === `/p/${encodeURIComponent(slug)}`
    );
  } catch {
    return t.includes(needle);
  }
}

export function CmsSiteMapPanel() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [nav, setNav] = useState<CmsNavigationPayload | null>(null);
  const [navHasDraft, setNavHasDraft] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [localeFilter, setLocaleFilter] = useState<string>("");
  const [onlyPublishedNotInNav, setOnlyPublishedNotInNav] = useState(false);
  const [onlyBrokenParent, setOnlyBrokenParent] = useState(false);

  const load = useCallback(() => {
    setErr(null);
    setLoading(true);
    Promise.all([
      fetch("/api/admin/cms/pages").then(async (r) => {
        const j = (await r.json()) as { data?: PageRow[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? "pages");
        return j.data ?? [];
      }),
      fetch("/api/admin/cms/navigation").then(async (r) => {
        const j = (await r.json()) as {
          data?: CmsNavigationPayload;
          meta?: { hasDraft?: boolean };
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? "navigation");
        return j;
      }),
    ])
      .then(([p, navRes]) => {
        setPages(p);
        setNav(navRes.data ?? null);
        setNavHasDraft(Boolean(navRes.meta?.hasDraft));
      })
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Load failed"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hrefs = useMemo(
    () => (nav ? collectNavHrefs(nav) : new Set<string>()),
    [nav],
  );

  const localeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of pages) {
      s.add(p.locale);
    }
    return Array.from(s).sort();
  }, [pages]);

  const slugLocaleKeys = useMemo(() => {
    const s = new Set<string>();
    for (const p of pages) {
      s.add(`${p.locale}:${p.slug}`);
    }
    return s;
  }, [pages]);

  const tableRows: EnrichedRow[] = useMemo(() => {
    return pages.map((p) => {
      let linked = false;
      for (const h of hrefs) {
        if (hrefMentionsCmsSlug(h, p.slug)) {
          linked = true;
          break;
        }
      }
      const parentKey = p.parent_slug?.trim() ?? "";
      const brokenParent =
        parentKey.length > 0
          ? !slugLocaleKeys.has(`${p.locale}:${parentKey}`)
          : false;
      const notes: string[] = [];
      if (p.status === "published" && !linked) {
        notes.push(
          "Published but no header/footer link points to /p/this slug",
        );
      }
      if (brokenParent) {
        notes.push(`Parent "${parentKey}" missing for locale ${p.locale}`);
      }
      return { ...p, linked, brokenParent, notes: notes.join(" · ") };
    });
  }, [pages, hrefs, slugLocaleKeys]);

  const filteredRows = useMemo(() => {
    return tableRows.filter((r) => {
      if (localeFilter && r.locale !== localeFilter) return false;
      if (onlyPublishedNotInNav && (r.status !== "published" || r.linked))
        return false;
      if (onlyBrokenParent && !r.brokenParent) return false;
      return true;
    });
  }, [tableRows, localeFilter, onlyPublishedNotInNav, onlyBrokenParent]);

  const orphanPublished = tableRows.filter(
    (r) => r.status === "published" && !r.linked,
  ).length;

  const brokenParentCount = tableRows.filter((r) => r.brokenParent).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => load()}
        >
          Refresh
        </button>
        {navHasDraft ? (
          <p className="text-xs text-amber-800">
            Navigation has an unpublished draft. This table reflects merged
            draft + live links.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <label className="text-xs font-medium text-slate-600">
          Locale
          <select
            className="mt-1 block min-w-[140px] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value)}
          >
            <option value="">All locales</option>
            {localeOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={onlyPublishedNotInNav}
            onChange={(e) => setOnlyPublishedNotInNav(e.target.checked)}
          />
          Published, not in nav (orphans only)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={onlyBrokenParent}
            onChange={(e) => setOnlyBrokenParent(e.target.checked)}
          />
          Broken parent only
        </label>
        {(localeFilter || onlyPublishedNotInNav || onlyBrokenParent) && (
          <button
            type="button"
            className="text-xs font-medium text-primary underline"
            onClick={() => {
              setLocaleFilter("");
              setOnlyPublishedNotInNav(false);
              setOnlyBrokenParent(false);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      <p className="text-sm text-slate-600">
        <span className="font-medium">{filteredRows.length}</span> row(s) shown
        {filteredRows.length !== tableRows.length ? (
          <span>
            {" "}
            of {tableRows.length} total · {pages.length} page record(s) loaded
          </span>
        ) : (
          <span> · {pages.length} page(s)</span>
        )}
        .{" "}
        {orphanPublished > 0 ? (
          <span className="font-medium text-amber-900">
            {orphanPublished} published page(s) have no link in the current
            navigation payload.
          </span>
        ) : (
          <span>Every published page appears in at least one nav href.</span>
        )}
        {brokenParentCount > 0 ? (
          <span className="block mt-1 text-slate-700">
            {brokenParentCount} page(s) reference a parent slug that does not
            exist for the same locale.
          </span>
        ) : null}
        <span className="block mt-2 text-xs text-slate-500">
          To change page content or slugs, use the Pages screen from this
          Content section.
        </span>
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">
                Slug
              </th>
              <th scope="col" className="px-3 py-2">
                Title
              </th>
              <th scope="col" className="px-3 py-2">
                Locale
              </th>
              <th scope="col" className="px-3 py-2">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                Parent
              </th>
              <th scope="col" className="px-3 py-2">
                In nav
              </th>
              <th scope="col" className="px-3 py-2">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  Loading site map...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-3 py-2 font-mono text-xs">{r.slug}</td>
                  <td
                    className="max-w-[200px] truncate px-3 py-2 text-xs"
                    title={r.title}
                  >
                    {r.title}
                  </td>
                  <td className="px-3 py-2">{r.locale}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {r.parent_slug?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2">{r.linked ? "Yes" : "No"}</td>
                  <td className="max-w-md px-3 py-2 text-xs text-slate-600">
                    {r.notes || "—"}
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
