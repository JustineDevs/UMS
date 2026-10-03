"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useSession } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import {
  cmsBlocksToTree,
  cmsTreeToBlocks,
  staffHasPermission,
  type CmsBlock,
  type CmsMutationRecord,
  type CmsNode,
} from "@universal-music-store/platform-data";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { readResponseJson } from "@/lib/read-response-json";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";
import { cmsPagePreviewUrl } from "@/lib/cms-preview-url";
import { Button } from "@universal-music-store/ui";

const CmsPageBuilder = dynamic(
  () => import("./CmsPageBuilder").then((module) => module.CmsPageBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading page editor…
      </div>
    ),
  },
);

const StorefrontPublicMetadataEditor = dynamic(
  () => import("@/components/StorefrontPublicMetadataEditor").then((module) => module.StorefrontPublicMetadataEditor),
  { ssr: false },
);
const StorefrontHomeVisualEditor = dynamic(
  () => import("./StorefrontHomeVisualEditor").then((module) => module.StorefrontHomeVisualEditor),
  { ssr: false },
);

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

function cmsPreviewOrigin(): string {
  if (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname)) {
    return window.location.origin;
  }
  return getStorefrontPublicOrigin();
}

function sanitizePreviewToken(value: string): string {
  return value.replace(/[^A-Za-z0-9._~-]/g, "");
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

export function CmsPagesManager({
  startInBuilder = false,
  onBuilderClose,
}: {
  startInBuilder?: boolean;
  onBuilderClose?: () => void;
}) {
  const { data: session, status } = useSession();
  const section = useSearchParams()?.get("section");
  const canWrite =
    process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" ||
    process.env.NODE_ENV === "development" ||
    session?.user?.role === "admin" ||
    staffHasPermission(session?.user?.permissions ?? [], "content:write");
  const [rows, setRows] = useState<CmsPageRow[]>([]);
  const [editing, setEditing] = useState<CmsPageRow | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mutationsRef = useRef<CmsMutationRecord[]>([]);
  const [blocksJson, setBlocksJson] = useState("[]");
  const [showBlocksAdvancedJson, setShowBlocksAdvancedJson] = useState(false);
  const [jsonLdText, setJsonLdText] = useState("");
  const [slugWhenOpened, setSlugWhenOpened] = useState<string | null>(null);
  const [redirectMessage, setRedirectMessage] = useState<string | null>(null);
  const [showStorefrontHome, setShowStorefrontHome] = useState(
    () => section === "home",
  );
  const [newPageDialogOpen, setNewPageDialogOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("New page");
  const [newPageSlug, setNewPageSlug] = useState("new-page");
  const [newPageTemplate, setNewPageTemplate] = useState("");
  const latestBlocksRef = useRef<CmsBlock[] | null>(null);
  const saveRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    setLoadingRows(true);
    setLoadError(null);
    void fetch("/api/admin/cms/pages", { signal })
      .then(async (response) => {
        const json = await readResponseJson<{
          data?: CmsPageRow[];
          error?: string;
        }>(response, {});
        if (!response.ok) throw new Error(json.error ?? response.statusText);
        setRows(json.data ?? []);
      })
      .catch((error: unknown) => {
        if (!signal?.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load content");
        }
      })
      .finally(() => {
        if (!signal?.aborted) setLoadingRows(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    setShowStorefrontHome(section === "home");
  }, [section]);
  useEffect(() => {
    if (!editing) return;
    setBlocksJson(JSON.stringify(editing.blocks ?? [], null, 2));
    setShowBlocksAdvancedJson(false);
    setJsonLdText(
      editing.json_ld == null ? "" : JSON.stringify(editing.json_ld, null, 2),
    );
  }, [editing]);

  const openPage = (page: CmsPageRow) => {
    saveRequestRef.current = null;
    mutationsRef.current = [];
    setSlugWhenOpened(page.slug);
    setRedirectMessage(null);
    setSaveError(null);
    const nextBlocks: CmsBlock[] = Array.isArray(page.tree) && page.tree.length
      ? cmsTreeToBlocks(page.tree as CmsNode[])
      : Array.isArray(page.blocks) ? page.blocks as CmsBlock[] : [];
    latestBlocksRef.current = nextBlocks;
    setEditing({
      ...page,
      blocks: nextBlocks,
      parent_slug: page.parent_slug ?? null,
      breadcrumb_label: page.breadcrumb_label ?? null,
    });
  };

  useEffect(() => {
    if (!startInBuilder || editing || loadingRows || showStorefrontHome || newPageDialogOpen) return;
    const homepage = rows.find((page) => {
      const slug = page.slug.trim().toLowerCase();
      return slug === "home" || slug === "/";
    });
    if (homepage) openPage(homepage);
    else setShowStorefrontHome(true);
  }, [editing, loadingRows, newPageDialogOpen, rows, showStorefrontHome, startInBuilder]);
  const openNewPage = () => {
    if (!canWrite) return;
    if (startInBuilder) setShowStorefrontHome(false);
    setNewPageTitle("New page");
    setNewPageSlug("new-page");
    setNewPageTemplate("");
    setNewPageDialogOpen(true);
  };

  const createNewPageDraft = () => {
    const template = rows.find((page) => page.id === newPageTemplate);
    const base = emptyPage();
    const slug = newPageSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "new-page";
    const title = newPageTitle.trim() || "New page";
    const draft: CmsPageRow = template
      ? {
          ...base,
          title,
          slug,
          body: template.body,
          page_type: template.page_type,
          blocks: Array.isArray(template.tree) && template.tree.length
            ? cmsTreeToBlocks(template.tree as CmsNode[])
            : template.blocks,
        }
      : { ...base, title, slug };
    const draftBlocks = Array.isArray(draft.blocks)
      ? (draft.blocks as CmsBlock[])
      : [];
    saveRequestRef.current = null;
    latestBlocksRef.current = draftBlocks;
    mutationsRef.current = [];
    setSlugWhenOpened(null);
    setRedirectMessage(null);
    setSaveError(null);
    setEditing({ ...draft, blocks: draftBlocks });
    setNewPageDialogOpen(false);
  };

  const duplicatePage = (id: string) => {
    if (!canWrite) return;
    const source = rows.find((page) => page.id === id);
    if (!source) return;
    const sourceBlocks = Array.isArray(source.tree) && source.tree.length
      ? cmsTreeToBlocks(source.tree as CmsNode[])
      : source.blocks;
    const duplicateBlocks = Array.isArray(sourceBlocks)
      ? (sourceBlocks as CmsBlock[])
      : [];
    saveRequestRef.current = null;
    latestBlocksRef.current = duplicateBlocks;
    mutationsRef.current = [];
    setSlugWhenOpened(null);
    setRedirectMessage(null);
    setSaveError(null);
    setEditing({
      ...source,
      id: "",
      title: `${source.title || source.slug} copy`,
      slug: `${source.slug.replace(/^\/+|\/+$/g, "")}-copy`,
      blocks: duplicateBlocks,
      status: "draft",
      published_at: null,
      scheduled_publish_at: null,
      preview_token: null,
      version: 1,
    });
  };

  const previewPage = (id: string) => {
    const page = rows.find((item) => item.id === id);
    if (!page) return;
    const normalizedSlug = page.slug.trim().toLowerCase();
    const isHomepage = normalizedSlug === "home" || normalizedSlug === "/";
    const pageUrl = isHomepage
      ? `${cmsPreviewOrigin()}/`
      : `${cmsPreviewOrigin()}/p/${page.slug.replace(/^\/+/, "").replace(/^p\//, "")}`;
    const previewUrl = sanitizeTrustedPublicUrl(
      cmsPagePreviewUrl(pageUrl, page.preview_token),
      [cmsPreviewOrigin()],
    );
    if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const deletePage = async (id: string) => {
    if (!canWrite || !confirm("Delete this page?")) return;
    const response = await fetch(`/api/admin/cms/pages/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey(`cms-page-delete-${id}`) },
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setLoadError(json.error ?? "Unable to delete page");
      return;
    }
    if (editing?.id === id) setEditing(null);
    load();
  };

  const newPageDialog = newPageDialogOpen && typeof document !== "undefined" ? createPortal(
    <dialog open aria-labelledby="new-page-dialog-title" className="pointer-events-auto fixed inset-0 z-[100] m-0 grid h-dvh w-dvw max-w-none place-items-center overflow-y-auto border-0 bg-slate-950/35 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-page-dialog-title" className="text-sm font-semibold text-slate-900">New page</h2>
            <p className="mt-1 text-xs text-slate-500">Create a page from a blank template or an existing page.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-900" onClick={() => setNewPageDialogOpen(false)}>Close</Button>
        </div>
        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">Page title<input autoFocus value={newPageTitle} onChange={(event) => setNewPageTitle(event.target.value)} className="mt-1 h-9 w-full rounded border border-slate-200 px-2 text-sm text-slate-800" /></label>
          <label className="block text-xs text-slate-600">URL slug<input value={newPageSlug} onChange={(event) => setNewPageSlug(event.target.value)} className="mt-1 h-9 w-full rounded border border-slate-200 px-2 text-sm text-slate-800" /></label>
          <label className="block text-xs text-slate-600">Start from template<select value={newPageTemplate} onChange={(event) => setNewPageTemplate(event.target.value)} className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm text-slate-800"><option value="">Blank page</option>{rows.map((page) => <option key={page.id} value={page.id}>{page.title || page.slug}</option>)}</select></label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" className="text-xs text-slate-600" onClick={() => setNewPageDialogOpen(false)}>Cancel</Button>
          <Button type="button" size="sm" className="text-xs font-semibold" onClick={createNewPageDraft}>Create page</Button>
        </div>
      </div>
    </dialog>,
    document.body,
  ) : null;

  const save = async (currentBlocks?: CmsBlock[]) => {
    if (!editing || !canWrite) {
      setSaveError(!canWrite ? "You do not have permission to save this page." : "No page is selected.");
      return;
    }
    setSaveError(null);
    let blocks: CmsBlock[] = currentBlocks ?? latestBlocksRef.current ?? (Array.isArray(editing.blocks)
      ? (editing.blocks as CmsBlock[])
      : []);
    if (!Array.isArray(blocks)) blocks = [];
    if (showBlocksAdvancedJson) {
      try {
        blocks = JSON.parse(blocksJson) as CmsBlock[];
        if (!Array.isArray(blocks)) throw new Error();
      } catch {
        setSaveError("Blocks must be a valid JSON array");
        return;
      }
    }
    let json_ld: unknown | null = null;
    if (jsonLdText.trim()) {
      try {
        json_ld = JSON.parse(jsonLdText) as unknown;
      } catch {
        setSaveError("JSON-LD must be valid JSON");
        return;
      }
    }
    if (editing.status === "scheduled" && !editing.scheduled_publish_at) {
      setSaveError("Choose a scheduled publish date before saving.");
      return;
    }
    const payload: Record<string, unknown> = {
      slug: editing.slug,
      locale: editing.locale,
      page_type: editing.page_type,
      title: editing.title,
      body: editing.body,
      blocks,
      tree: cmsBlocksToTree(blocks),
      mutations: mutationsRef.current,
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
    const saveFingerprint = JSON.stringify(payload);
    const saveRequestKey = saveRequestRef.current?.fingerprint === saveFingerprint
      ? saveRequestRef.current.key
      : idempotencyKey(editing.id ? `cms-page-${editing.id}` : "cms-page-new");
    saveRequestRef.current = { fingerprint: saveFingerprint, key: saveRequestKey };
    try {
      const endpoint = editing.id
        ? `/api/admin/cms/pages/${encodeURIComponent(editing.id)}`
        : "/api/admin/cms/pages";
      const response = await fetch(endpoint, {
        method: editing.id ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": saveRequestKey,
          ...(editing.id ? { "If-Match": String(editing.version ?? 1) } : {}),
        },
        body: JSON.stringify(payload),
      });
      const savedJson = await readResponseJson(response, {} as { data?: CmsPageRow; error?: string });
      if (!response.ok || !savedJson.data) throw new Error(savedJson.error ?? `Unable to save (${response.status})`);
      const saved = { data: savedJson.data };
      if (saved.data) {
        latestBlocksRef.current = Array.isArray((saved.data as CmsPageRow).blocks)
          ? (saved.data as CmsPageRow).blocks as CmsBlock[]
          : blocks;
        setEditing(saved.data as CmsPageRow);
        setSlugWhenOpened(saved.data.slug);
        mutationsRef.current = [];
        saveRequestRef.current = null;
      }
      load();
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Unable to save");
    } finally {
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

  // The dedicated Build route must never flash the legacy page-list workspace
  // while its initial page selection is being resolved. Keep the route in its
  // immersive shell until the homepage/page editor is ready.
  if (
    startInBuilder &&
    (loadingRows || (!editing && !showStorefrontHome && !newPageDialogOpen))
  ) {
    return (
      <div className="flex min-h-full min-w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading visual builder…
      </div>
    );
  }

  if (showStorefrontHome) {
    const homeEditor = (
      <StorefrontHomeVisualEditor
        onClose={() => {
          if (startInBuilder && onBuilderClose) onBuilderClose();
          else setShowStorefrontHome(false);
        }}
        onNewPage={openNewPage}
      />
    );
    if (startInBuilder) {
      return (
        <>
          {homeEditor}
          {newPageDialog}
        </>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Homepage
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The public homepage is managed here as the first page in the
              same Build workspace as every other page.
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
        {homeEditor}
        {newPageDialog}
      </div>
    );
  }

  if (editing) {
    const isHomepage = editing.slug.trim().toLowerCase() === "home" || editing.slug.trim() === "/";
    const pageUrl = isHomepage
      ? `${cmsPreviewOrigin()}/?adminPreview=1`
      : `${cmsPreviewOrigin()}/p/${editing.slug.replace(/^\/+/, "").replace(/^p\//, "")}`;
    const previewUrl =
      sanitizeTrustedPublicUrl(
        cmsPagePreviewUrl(pageUrl, editing.preview_token),
        [cmsPreviewOrigin()],
      ) ?? "";
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
                  preview_token: sanitizePreviewToken(e.target.value) || null,
                })
              }
            />
          </label>
          <label className="mt-3 block text-slate-500">
            Scheduled publish date
            <input
              type="datetime-local"
              className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={editing.scheduled_publish_at ? editing.scheduled_publish_at.slice(0, 16) : ""}
              disabled={editing.status !== "scheduled"}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  scheduled_publish_at: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
            />
            <span className="mt-1 block text-[10px] text-slate-400">
              Required when status is scheduled.
            </span>
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
              aria-label="Advanced blocks JSON"
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
      <>
        {newPageDialog}
      <CmsPageBuilder
        value={editing.blocks ?? []}
        disabled={!canWrite}
        immersive
        pageTitle={editing.title}
        pageBody={editing.body}
        onPageBodyChange={(body) => setEditing({ ...editing, body })}
        onSave={(currentBlocks) => void save(currentBlocks)}
        previewUrl={previewUrl}
        previewMode={isHomepage ? "home" : "page"}
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
        onDeletePage={(id) => void deletePage(id)}
        onDuplicatePage={duplicatePage}
        onPreviewPage={previewPage}
        settings={settings}
        onClose={() => {
          if (onBuilderClose) onBuilderClose();
          else setEditing(null);
        }}
        onChange={(next: CmsBlock[]) =>
          (latestBlocksRef.current = next, setEditing((current) => current ? { ...current, blocks: next } : current))
        }
        onMutation={(mutation) => {
          mutationsRef.current = [...mutationsRef.current, mutation];
        }}
      />
      </>
    );
  }

  return (
    <>
    {newPageDialog}
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
            publish settings live in this unified Build workspace.
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
          No pages exist yet. Create a page to open the Build workspace.
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
    </>
  );
}
