"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  cmsBlocksToTree,
  cmsTreeToBlocks,
  staffHasPermission,
  type CmsBlock,
  type CmsMutationRecord,
  type CmsNode,
} from "@universal-music-store/platform-data";
import { useCallback, useEffect, useState } from "react";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";
import { cmsPagePreviewUrl } from "@/lib/cms-preview-url";
import { StorefrontPublicMetadataEditor } from "@/components/StorefrontPublicMetadataEditor";
import { CmsPageBuilder } from "./CmsPageBuilder";
import { StorefrontHomeVisualEditor } from "./StorefrontHomeVisualEditor";

type CmsPageRow = {
  id: string;
  slug: string;
  locale: string;
  page_type: string;
  title: string;
  body: string;
  blocks: unknown;
  tree?: unknown;
  status: string;
  published_at: string | null;
  scheduled_publish_at: string | null;
  preview_token: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
  json_ld: unknown | null;
  parent_slug: string | null;
  breadcrumb_label: string | null;
  version?: number;
};

function idempotencyKey(scope: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyPage(): CmsPageRow {
  return {
    id: "",
    slug: "new-page",
    locale: "en",
    page_type: "static",
    title: "New page",
    body: "<p></p>",
    blocks: [],
    status: "draft",
    published_at: null,
    scheduled_publish_at: null,
    preview_token: null,
    meta_title: null,
    meta_description: null,
    canonical_url: null,
    og_image_url: null,
    json_ld: null,
    parent_slug: null,
    breadcrumb_label: null,
    version: 1,
  };
}

export function CmsPagesManager() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const canWrite =
    process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" ||
    staffHasPermission(session?.user?.permissions ?? [], "content:write");
  const [rows, setRows] = useState<CmsPageRow[]>([]);
  const [editing, setEditing] = useState<CmsPageRow | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mutations, setMutations] = useState<CmsMutationRecord[]>([]);
  const [blocksJson, setBlocksJson] = useState("[]");
  const [showBlocksAdvancedJson, setShowBlocksAdvancedJson] = useState(false);
  const [jsonLdText, setJsonLdText] = useState("");
  const [slugWhenOpened, setSlugWhenOpened] = useState<string | null>(null);
  const [redirectMessage, setRedirectMessage] = useState<string | null>(null);
  const [showStorefrontHome, setShowStorefrontHome] = useState(
    () => searchParams.get("section") === "home",
  );

  const load = useCallback(() => {
    setLoadingRows(true);
    setLoadError(null);
    void fetch("/api/admin/cms/pages")
      .then(async (response) => {
        const json = (await response.json()) as {
          data?: CmsPageRow[];
          error?: string;
        };
        if (!response.ok) throw new Error(json.error ?? response.statusText);
        setRows(json.data ?? []);
      })
      .catch((error: unknown) =>
        setLoadError(
          error instanceof Error ? error.message : "Unable to load content",
        ),
      )
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setShowStorefrontHome(searchParams.get("section") === "home");
  }, [searchParams]);
  useEffect(() => {
    if (!editing) return;
    setBlocksJson(JSON.stringify(editing.blocks ?? [], null, 2));
    setShowBlocksAdvancedJson(false);
    setJsonLdText(
      editing.json_ld == null ? "" : JSON.stringify(editing.json_ld, null, 2),
    );
  }, [editing]);

  const openPage = (page: CmsPageRow) => {
    setMutations([]);
    setSlugWhenOpened(page.slug);
    setRedirectMessage(null);
    setSaveError(null);
    setEditing({
      ...page,
      blocks: Array.isArray(page.tree) && page.tree.length
        ? cmsTreeToBlocks(page.tree as CmsNode[])
        : page.blocks,
      parent_slug: page.parent_slug ?? null,
      breadcrumb_label: page.breadcrumb_label ?? null,
    });
  };
  const openNewPage = () => {
    setMutations([]);
    setSlugWhenOpened(null);
    setRedirectMessage(null);
    setSaveError(null);
    setEditing(emptyPage());
  };

  const save = async () => {
    if (!editing || !canWrite) return;
    setSaving(true);
    setSaveError(null);
    let blocks: CmsBlock[] = Array.isArray(editing.blocks)
      ? (editing.blocks as CmsBlock[])
      : [];
    if (showBlocksAdvancedJson) {
      try {
        blocks = JSON.parse(blocksJson) as CmsBlock[];
        if (!Array.isArray(blocks)) throw new Error();
      } catch {
        setSaveError("Blocks must be a valid JSON array");
        setSaving(false);
        return;
      }
    }
    let json_ld: unknown | null = null;
    if (jsonLdText.trim()) {
      try {
        json_ld = JSON.parse(jsonLdText) as unknown;
      } catch {
        setSaveError("JSON-LD must be valid JSON");
        setSaving(false);
        return;
      }
    }
    const payload: Record<string, unknown> = {
      slug: editing.slug,
      locale: editing.locale,
      page_type: editing.page_type,
      title: editing.title,
      body: editing.body,
      blocks,
      tree: cmsBlocksToTree(blocks),
      mutations,
      status: editing.status,
      published_at: editing.published_at,
      scheduled_publish_at: editing.scheduled_publish_at,
      preview_token: editing.preview_token,
      meta_title: editing.meta_title,
      meta_description: editing.meta_description,
      canonical_url: editing.canonical_url,
      og_image_url: editing.og_image_url,
      json_ld,
      parent_slug: editing.parent_slug,
      breadcrumb_label: editing.breadcrumb_label,
      ...(editing.id && editing.version ? { expectedVersion: editing.version } : {}),
    };
    if (editing.id) payload.id = editing.id;
    try {
      const response = await fetch(
        editing.id
          ? `/api/admin/cms/pages/${editing.id}`
          : "/api/admin/cms/pages",
        {
          method: editing.id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey(`cms-page-${editing.id ?? "new"}`),
          },
          body: JSON.stringify(payload),
        },
      );
      const json = (await response.json()) as {
        data?: CmsPageRow;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      if (json.data) {
        setEditing(json.data);
        setSlugWhenOpened(json.data.slug);
        setMutations([]);
      }
      load();
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing?.id || !canWrite || !confirm("Delete this page?")) return;
    const response = await fetch(`/api/admin/cms/pages/${editing.id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey(`cms-page-delete-${editing.id}`) },
    });
    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setSaveError(json.error ?? "Unable to delete");
      return;
    }
    setEditing(null);
    load();
  };

  const createSlugRedirect = async () => {
    if (
      !editing?.id ||
      !slugWhenOpened ||
      slugWhenOpened === editing.slug ||
      !canWrite
    )
      return;
    const from_path = `/p/${slugWhenOpened.replace(/^\/+/, "").replace(/^p\//, "")}`;
    const to_path = `/p/${editing.slug.replace(/^\/+/, "").replace(/^p\//, "")}`;
    const response = await fetch("/api/admin/cms/redirects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey(`cms-redirect-${editing.id}`),
      },
      body: JSON.stringify({
        from_path,
        to_path,
        status_code: 301,
        active: true,
      }),
    });
    const json = (await response.json()) as { error?: string };
    setRedirectMessage(
      response.ok
        ? `Redirect saved: ${from_path} -> ${to_path}`
        : (json.error ?? "Could not create redirect"),
    );
  };

  if (status === "loading")
    return <p className="text-sm text-slate-600">Loading session...</p>;

  if (showStorefrontHome) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Homepage
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The public homepage is managed here as the first page in the
              same CMS workspace as every other page.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setShowStorefrontHome(false)}
          >
            Back to page list
          </button>
        </div>
        <StorefrontPublicMetadataEditor />
        <StorefrontHomeVisualEditor
          onClose={() => setShowStorefrontHome(false)}
        />
      </div>
    );
  }

  if (editing) {
    const pageUrl = `${getStorefrontPublicOrigin()}/p/${editing.slug.replace(/^\/+/, "").replace(/^p\//, "")}`;
    const previewUrl = cmsPagePreviewUrl(pageUrl, editing.preview_token);
    const settings = (
      <div className="space-y-4 text-xs">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Page identity
          </p>
          <label className="block text-slate-500">
            Slug
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.slug}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
            />
          </label>
          <label className="mt-3 block text-slate-500">
            Title
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.title}
              onChange={(e) =>
                setEditing({ ...editing, title: e.target.value })
              }
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block text-slate-500">
              Locale
              <select
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                value={editing.locale}
                onChange={(e) =>
                  setEditing({ ...editing, locale: e.target.value })
                }
              >
                <option value="en">en</option>
                <option value="fil">fil</option>
              </select>
            </label>
            <label className="block text-slate-500">
              Type
              <select
                className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                value={editing.page_type}
                onChange={(e) =>
                  setEditing({ ...editing, page_type: e.target.value })
                }
              >
                <option value="static">static</option>
                <option value="landing">landing</option>
                <option value="legal">legal</option>
              </select>
            </label>
          </div>
        </div>
        <label className="block text-slate-500">
          Body HTML
          <textarea
            className="mt-1 min-h-28 w-full rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700"
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          />
        </label>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Navigation
          </p>
          <label className="block text-slate-500">
            Parent slug
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.parent_slug ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, parent_slug: e.target.value || null })
              }
            />
          </label>
          <label className="mt-3 block text-slate-500">
            Breadcrumb label
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.breadcrumb_label ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  breadcrumb_label: e.target.value || null,
                })
              }
            />
          </label>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Publishing
          </p>
          <label className="block text-slate-500">
            Status
            <select
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.status}
              onChange={(e) =>
                setEditing({ ...editing, status: e.target.value })
              }
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="scheduled">scheduled</option>
            </select>
          </label>
          <label className="mt-3 block text-slate-500">
            Preview token
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 font-mono text-[11px] text-slate-700"
              value={editing.preview_token ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  preview_token: e.target.value || null,
                })
              }
            />
          </label>
          <a
            className="mt-3 inline-flex text-xs text-primary underline"
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open storefront preview
          </a>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            SEO
          </p>
          <label className="block text-slate-500">
            Meta title
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.meta_title ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, meta_title: e.target.value || null })
              }
            />
          </label>
          <label className="mt-3 block text-slate-500">
            Meta description
            <textarea
              className="mt-1 min-h-20 w-full rounded border border-slate-200 bg-white p-2 text-xs text-slate-700"
              value={editing.meta_description ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  meta_description: e.target.value || null,
                })
              }
            />
          </label>
          <label className="mt-3 block text-slate-500">
            Canonical URL
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.canonical_url ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  canonical_url: e.target.value || null,
                })
              }
            />
          </label>
          <label className="mt-3 block text-slate-500">
            OG image URL
            <input
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.og_image_url ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, og_image_url: e.target.value || null })
              }
            />
          </label>
          <label className="mt-3 block text-slate-500">
            JSON-LD
            <textarea
              className="mt-1 min-h-20 w-full rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700"
              value={jsonLdText}
              onChange={(e) => setJsonLdText(e.target.value)}
            />
          </label>
        </div>
        <div>
          <button
            type="button"
            className="text-[11px] text-slate-500 underline"
            onClick={() => setShowBlocksAdvancedJson((value) => !value)}
          >
            {showBlocksAdvancedJson ? "Hide" : "Show"} advanced blocks JSON
          </button>
          {showBlocksAdvancedJson ? (
            <textarea
              className="mt-2 min-h-40 w-full rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700"
              value={blocksJson}
              onChange={(e) => setBlocksJson(e.target.value)}
            />
          ) : null}
        </div>
        {slugWhenOpened && slugWhenOpened !== editing.slug ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
            <p>Slug changed from {slugWhenOpened}</p>
            <button
              type="button"
              className="mt-2 underline"
              onClick={() => void createSlugRedirect()}
            >
              Create 301 redirect
            </button>
            {redirectMessage ? (
              <p className="mt-2 text-slate-600">{redirectMessage}</p>
            ) : null}
          </div>
        ) : null}
        {saveError ? (
          <p
            className="rounded border border-red-200 bg-red-50 p-3 text-[11px] text-red-700"
            role="alert"
          >
            {saveError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            className="h-8 rounded bg-red-50 px-3 text-xs text-red-700 hover:bg-red-100"
            disabled={!canWrite || !editing.id}
            onClick={() => void remove()}
          >
            Delete page
          </button>
          <button
            type="button"
            className="h-8 rounded border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() => setEditing(null)}
          >
            Close editor
          </button>
        </div>
      </div>
    );
    return (
      <CmsPageBuilder
        value={editing.blocks ?? []}
        disabled={!canWrite}
        immersive
        pageTitle={editing.title}
        pageBody={editing.body}
        onPageBodyChange={(body) => setEditing({ ...editing, body })}
        previewUrl={previewUrl}
        pages={rows.map((page) => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
        }))}
        currentPageId={editing.id}
        onSelectPage={(id) => {
          const page = rows.find((item) => item.id === id);
          if (page) openPage(page);
        }}
        onNewPage={openNewPage}
        settings={settings}
        toolbarActions={
          <button
            type="button"
            className="h-8 rounded bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={!canWrite || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        }
        onClose={() => setEditing(null)}
        onChange={(next: CmsBlock[]) =>
          setEditing({ ...editing, blocks: next })
        }
        onMutation={(mutation) => setMutations((current) => [...current, mutation])}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pages</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a page to open the visual editor.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={openNewPage}
        >
          New page
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Homepage
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Homepage sections, navigation-aware preview, SEO metadata, and
            publish settings live in this unified CMS workspace.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
          onClick={() => setShowStorefrontHome(true)}
        >
          Edit homepage
        </button>
      </div>
      {loadError ? <p className="text-sm text-red-700">{loadError}</p> : null}
      {loadingRows ? (
        <p className="text-sm text-slate-600">Loading pages...</p>
      ) : null}
      {!loadingRows && !rows.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No CMS pages exist yet. Create a page to open the editor.
        </div>
      ) : null}
      {rows.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_7rem] border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Page</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          {rows.map((page) => (
            <div
              key={page.id}
              className="grid grid-cols-[minmax(0,1fr)_8rem_7rem] items-center border-b border-slate-100 px-4 py-4 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {page.title || page.slug}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-slate-500">
                  /p/{page.slug}
                </p>
              </div>
              <span className="text-xs text-slate-500">{page.status}</span>
              <button
                type="button"
                className="justify-self-end text-xs font-semibold text-primary underline"
                onClick={() => openPage(page)}
              >
                Open editor
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
