"use client";

import { staffHasPermission } from "@universal-music-store/platform-data";
import { useSession } from "@/lib/auth-client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Copy, ExternalLink, File as FileIcon, FileText, HardDrive, Image, Trash2, Upload, Video } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-console";
import { CatalogMediaPreview } from "./CatalogMediaPreview";
import { inferCatalogMediaMimeType } from "./catalog-media-mime";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";
import { catalogMediaEmptyState } from "@/lib/admin-receipt-media-state";

type MediaRow = {
  id: string;
  public_url: string;
  alt_text: string | null;
  created_at: string;
  mime_type: string | null;
  display_name: string | null;
  byte_size: number | null;
  tags: string[];
};

const ACCEPT_ATTR = "image/*,video/*,.webp,.svg,.mp4,.webm,.mov,.ogg";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const BUCKET_CONFIG: Omit<MediaBucket, "count" | "bytes">[] = [
  { key: "documents", label: "Documents", icon: FileText, color: "bg-blue-500" },
  { key: "images", label: "Images", icon: Image, color: "bg-emerald-500" },
  { key: "videos", label: "Videos", icon: Video, color: "bg-violet-500" },
  { key: "others", label: "Others", icon: FileIcon, color: "bg-amber-500" },
];

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name);
}

function droppedFiles(dataTransfer: DataTransfer): File[] {
  const itemFiles: File[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) itemFiles.push(file);
  }
  return itemFiles.length ? itemFiles : Array.from(dataTransfer.files);
}

type MediaBucket = {
  key: "documents" | "images" | "videos" | "others";
  label: string;
  count: number;
  bytes: number;
  icon: typeof FileIcon;
  color: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function mediaBucketKey(publicUrl: string, mimeType: string | null): MediaBucket["key"] {
  const inferred = inferCatalogMediaMimeType(publicUrl, mimeType);
  if (inferred?.startsWith("image/")) return "images";
  if (inferred?.startsWith("video/")) return "videos";
  if (inferred?.startsWith("text/") || inferred?.includes("pdf") || inferred?.includes("document")) return "documents";
  return "others";
}

type MediaLoadState = {
  rows: MediaRow[];
  error: string | null;
  loadingRows: boolean;
  catalogSourceUnavailable: boolean;
  serverCanWrite: boolean;
};

type MediaLoadAction =
  | { type: "loading"; value: boolean }
  | { type: "error"; value: string | null }
  | { type: "rows"; value: MediaRow[] }
  | { type: "permissions"; canWrite: boolean; sourceUnavailable: boolean };

function mediaLoadReducer(state: MediaLoadState, action: MediaLoadAction): MediaLoadState {
  switch (action.type) {
    case "loading": return { ...state, loadingRows: action.value };
    case "error": return { ...state, error: action.value };
    case "rows": return { ...state, rows: action.value };
    case "permissions":
      return {
        ...state,
        serverCanWrite: action.canWrite,
        catalogSourceUnavailable: action.sourceUnavailable,
      };
    default: return state;
  }
}

/** Catalog-scoped media library and asset management. */
export function CatalogMediaManager() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(session?.user?.permissions ?? [], "catalog:write");
  const [{ rows, error, loadingRows, catalogSourceUnavailable, serverCanWrite }, dispatchLoad] = useReducer(
    mediaLoadReducer,
    { rows: [], error: null, loadingRows: true, catalogSourceUnavailable: false, serverCanWrite: false },
  );
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [mime, setMime] = useState("");
  const [sort, setSort] = useState<"created_desc" | "created_asc" | "name_asc" | "name_desc">(
    "created_desc",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAlt, setEditAlt] = useState("");
  const [editTags, setEditTags] = useState("");
  const [refsText, setRefsText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(() => {
    const sp = new URLSearchParams();
    sp.set("limit", "200");
    if (q.trim()) sp.set("q", q.trim());
    if (mime.trim()) sp.set("mime", mime.trim());
    sp.set("sort", sort);
    dispatchLoad({ type: "loading", value: true });
    dispatchLoad({ type: "error", value: null });
    fetch(`/api/admin/catalog/media?${sp.toString()}`)
      .then(async (r) => {
        const j = (await r.json()) as {
          data?: MediaRow[];
          error?: string;
          canWrite?: boolean;
          catalogSourceUnavailable?: boolean;
        };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        dispatchLoad({
          type: "permissions",
          canWrite: Boolean(j.canWrite),
          sourceUnavailable: Boolean(j.catalogSourceUnavailable),
        });
        return j.data ?? [];
      })
      .then((value) => dispatchLoad({ type: "rows", value }))
      .catch((e: unknown) => dispatchLoad({ type: "error", value: e instanceof Error ? e.message : "Unable to load catalog media" }))
      .finally(() => dispatchLoad({ type: "loading", value: false }));
  }, [q, mime, sort]);

  useEffect(() => {
    const t = setTimeout(() => load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const uploadFiles = (files: File[]) => {
    if (!files.length || !(canWrite || serverCanWrite)) return;
    for (const file of files) {
      const maxBytes = isVideoFile(file) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        dispatchLoad({ type: "error", value: `"${file.name}" exceeds ${Math.round(maxBytes / (1024 * 1024))} MB.` });
        return;
      }
    }
    setUploading(true);
    setUploadPct(0);
    dispatchLoad({ type: "error", value: null });

    const run = async () => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);
        fd.append("alt", file.name);
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/admin/catalog/media");
          xhr.setRequestHeader("Idempotency-Key", crypto.randomUUID());
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const base = (i / files.length) * 100;
              const part = (ev.loaded / ev.total) * (100 / files.length);
              setUploadPct(Math.round(base + part));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(xhr.responseText || xhr.statusText));
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(fd);
        });
      }
      setUploadPct(null);
      setUploading(false);
      load();
      if (inputRef.current) inputRef.current.value = "";
    };

    void run().catch((e: unknown) => {
      dispatchLoad({ type: "error", value: e instanceof Error ? e.message : "Upload failed" });
      setUploadPct(null);
      setUploading(false);
    });
  };

  const onFileInput = (f: FileList | null) => {
    if (!f?.length) return;
    uploadFiles(Array.from(f));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    if (!(canWrite || serverCanWrite) || uploading) return;
    const list = droppedFiles(e.dataTransfer);
    if (!list?.length) return;
    uploadFiles(Array.from(list));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if ((canWrite || serverCanWrite) && !uploading) setDragOver(true);
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    if ((canWrite || serverCanWrite) && !uploading) setDragOver(true);
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };

  const openRow = (m: MediaRow) => {
    setOpenId(m.id);
    setEditDisplayName(m.display_name ?? "");
    setEditAlt(m.alt_text ?? "");
    setEditTags(m.tags?.join(", ") ?? "");
    setRefsText(null);
  };

  const loadRefs = (id: string) => {
    void fetch(`/api/admin/catalog/media/${id}?refs=1`)
      .then(async (r) => {
        if (!r.ok) return;
        const j = (await r.json()) as { data?: { refs?: unknown } };
        setRefsText(JSON.stringify(j.data?.refs ?? [], null, 2));
      })
      .catch(() => setRefsText("Unable to load references"));
  };

  const saveMeta = async (id: string) => {
    const tags = editTags
      .split(/[,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const r = await fetch(`/api/admin/catalog/media/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        display_name: editDisplayName.trim() || null,
        alt_text: editAlt || null,
        tags,
      }),
    });
    if (!r.ok) dispatchLoad({ type: "error", value: "Update failed" });
    else {
      dispatchLoad({ type: "error", value: null });
      load();
    }
  };

  const softDelete = async (id: string) => {
    if (!confirm("Archive this unused asset? Referenced assets cannot be archived.")) return;
    const r = await fetch(`/api/admin/catalog/media/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    if (!r.ok) {
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      dispatchLoad({ type: "error", value: body?.error ?? "Archive failed" });
    }
    else {
      setOpenId(null);
      load();
    }
  };

  const copyShareLink = async (media: MediaRow) => {
    const url = sanitizeTrustedPublicUrl(media.public_url);
    if (!url || !navigator.clipboard) {
      dispatchLoad({ type: "error", value: "This asset does not have a safe share URL." });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopiedId(media.id);
    window.setTimeout(() => setCopiedId((current) => current === media.id ? null : current), 1800);
  };

  if (status === "loading") return <p className="text-sm text-slate-600">Loading…</p>;

  const buckets = BUCKET_CONFIG.map((bucket) => {
    const matching = rows.filter((row) => mediaBucketKey(row.public_url, row.mime_type) === bucket.key);
    return { ...bucket, count: matching.length, bytes: matching.reduce((sum, row) => sum + (row.byte_size ?? 0), 0) };
  });
  const totalBytes = buckets.reduce((sum, bucket) => sum + bucket.bytes, 0);
  const recentRows = [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Catalog media"
        subtitle="Upload, organize, and maintain the assets used by products and storefront content."
        actions={
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!(canWrite || serverCanWrite) || uploading}
              className="order-first inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
            >
              <Upload className="size-4" />
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span>Search media</span>
              <input
                className="h-8 w-44 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="name, alt text, or URL"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span>MIME prefix</span>
              <input
                className="h-8 w-24 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
                value={mime}
                onChange={(e) => setMime(e.target.value)}
                placeholder="image/"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span>Sort</span>
              <select
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="created_desc">Newest</option>
                <option value="created_asc">Oldest</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
              </select>
            </label>
          </div>
        }
      />
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">Unable to load catalog media: {error}</p> : null}

      <section aria-label="Catalog media upload" className="grid gap-4">
        <div
          role="button"
          data-testid="catalog-media-dropzone"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => (canWrite || serverCanWrite) && !uploading && inputRef.current?.click()}
          onDrop={onDrop}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={[
            "flex min-h-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
            canWrite || serverCanWrite ? "cursor-pointer hover:border-slate-400" : "opacity-60",
          ].join(" ")}
        >
          <p className="text-sm font-medium text-foreground">
            {uploading ? `Uploading${uploadPct != null ? ` ${uploadPct}%` : "…"}` : "Drop files or click"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Images up to {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB; videos up to {Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPT_ATTR}
            multiple
            disabled={!(canWrite || serverCanWrite) || uploading}
            aria-label="Upload catalog media files"
            onChange={(e) => void onFileInput(e.target.files)}
          />
        </div>
      </section>

      <section aria-label="Catalog media overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {buckets.map((bucket) => {
          const Icon = bucket.icon;
          const percent = totalBytes ? Math.round((bucket.bytes / totalBytes) * 100) : 0;
          return (
            <article key={bucket.key} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Icon className="size-4 text-muted-foreground" />{bucket.label}</div>
                <span className="text-xs text-muted-foreground">{bucket.count} {bucket.count === 1 ? "asset" : "assets"}</span>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{formatBytes(bucket.bytes)}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className={`h-full rounded-full ${bucket.color}`} style={{ width: `${percent}%` }} /></div>
              <p className="mt-2 text-xs text-muted-foreground">{percent}% of loaded footprint</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm" aria-label="Catalog storage footprint">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-muted"><HardDrive className="size-4 text-muted-foreground" /></span><div><h2 className="text-sm font-semibold">Catalog storage footprint</h2><p className="mt-1 text-xs text-muted-foreground">{formatBytes(totalBytes)} across {rows.length} loaded assets</p></div></div>
          <span className="text-xs text-muted-foreground">Quota not configured</span>
        </div>
        <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-muted" aria-label="Storage mix by asset type">
          {buckets.map((bucket) => <div key={bucket.key} className={`${bucket.color} transition-[width] duration-150`} style={{ width: `${totalBytes ? (bucket.bytes / totalBytes) * 100 : 0}%` }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {buckets.map((bucket) => <span key={bucket.key} className="inline-flex items-center gap-2"><span className={`size-2 rounded-full ${bucket.color}`} />{bucket.label} {bucket.count}</span>)}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Recent uploads</h2><p className="mt-1 text-xs text-muted-foreground">Latest assets in the loaded catalog view</p></div><span className="text-xs text-muted-foreground">{rows.length} total</span></div>
          <div className="mt-4 divide-y divide-border/60">
            {recentRows.length ? recentRows.map((row) => <button key={row.id} type="button" onClick={() => openRow(row)} className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40">
              <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-muted"><CatalogMediaPreview publicUrl={row.public_url} mimeType={row.mime_type} className="h-full w-full object-cover" fallbackLabel="File" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.display_name || row.public_url.slice(-36)}</span><span className="mt-0.5 block text-xs text-muted-foreground">{inferCatalogMediaMimeType(row.public_url, row.mime_type) || "Unknown type"}</span></span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{row.byte_size != null ? formatBytes(row.byte_size) : "—"}</span>
            </button>) : <p className="py-8 text-center text-sm text-muted-foreground">No uploads in this view.</p>}
          </div>
        </article>
        <article className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div><h2 className="text-sm font-semibold">Asset type distribution</h2><p className="mt-1 text-xs text-muted-foreground">A live breakdown of the current catalog media set</p></div>
          <div className="mt-5 space-y-5">{buckets.map((bucket) => { const percent = totalBytes ? Math.round((bucket.bytes / totalBytes) * 100) : 0; return <div key={bucket.key}><div className="flex items-center justify-between text-sm"><span className="font-medium">{bucket.label}</span><span className="text-xs tabular-nums text-muted-foreground">{bucket.count} · {formatBytes(bucket.bytes)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${bucket.color}`} style={{ width: `${percent}%` }} /></div></div>; })}</div>
        </article>
      </section>

      {loadingRows ? <p className="text-sm text-muted-foreground" aria-live="polite">Loading catalog media...</p> : null}
      {!loadingRows && !error && catalogSourceUnavailable ? (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Product catalog media is temporarily unavailable. Existing uploaded media is shown; retry to mirror the latest product assets.
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Catalog media assets" aria-busy={loadingRows}>
        {rows.map((m) => (
          <li key={m.id} className="group overflow-hidden break-all rounded-xl border bg-card text-sm shadow-xs transition-shadow hover:shadow-md">
            <div className="aspect-[4/3] w-full bg-muted">
              <CatalogMediaPreview
                publicUrl={m.public_url}
                mimeType={m.mime_type}
                className="h-full w-full object-cover"
                fallbackLabel={m.display_name?.trim() || "File"}
              />
            </div>
            <div className="p-4">
            <button
              type="button"
              className="text-left font-medium text-foreground hover:underline"
              onClick={() => openRow(m)}
            >
              {m.display_name || m.public_url.slice(-40)}
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {sanitizeTrustedPublicUrl(m.public_url) ? <a
                href={sanitizeTrustedPublicUrl(m.public_url) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
              >
                <ExternalLink className="size-3" /> Open
              </a> : null}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={!sanitizeTrustedPublicUrl(m.public_url)}
                onClick={() => void copyShareLink(m)}
              >
                <Copy className="size-3" /> {copiedId === m.id ? "Copied" : "Copy share link"}
              </button>
              <button
                type="button"
                disabled={!(canWrite || serverCanWrite)}
                className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 disabled:opacity-40"
                onClick={() => void softDelete(m.id)}
                aria-label={`Archive ${m.display_name || "media asset"}`}
              >
                <Trash2 className="size-3" /> Archive
              </button>
            </div>
            {inferCatalogMediaMimeType(m.public_url, m.mime_type) ? <p className="mt-1 text-[11px] text-muted-foreground">{inferCatalogMediaMimeType(m.public_url, m.mime_type)}</p> : null}
            {m.byte_size != null ? (
              <p className="text-[11px] text-muted-foreground">{(m.byte_size / 1024).toFixed(1)} KB</p>
            ) : null}
            {m.alt_text ? (
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-medium text-foreground">Alt:</span> {m.alt_text}
              </p>
            ) : null}
            {m.tags?.length ? (
              <p className="text-[11px] text-muted-foreground">Tags: {m.tags.join(", ")}</p>
            ) : null}

            {openId === m.id ? (
              <div className="mt-3 space-y-2 border-t pt-3">
                <label className="block text-xs text-slate-600">
                  Display name
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="File label in admin lists"
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  Alt text
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm"
                    value={editAlt}
                    onChange={(e) => setEditAlt(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  Tags (comma-separated)
                  <input
                    className="mt-1 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!(canWrite || serverCanWrite)}
                    className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
                    onClick={() => void saveMeta(m.id)}
                  >
                    Save meta
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-input px-3 py-1 text-xs hover:bg-muted"
                    onClick={() => loadRefs(m.id)}
                  >
                    Where used
                  </button>
                  <button
                    type="button"
                    disabled={!(canWrite || serverCanWrite)}
                    className="rounded-lg border border-destructive/30 px-3 py-1 text-xs text-destructive disabled:opacity-50"
                    onClick={() => void softDelete(m.id)}
                  >
                    <Trash2 className="mr-1 inline size-3" /> Archive asset
                  </button>
                </div>
                {refsText ? (
                  <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-2 text-[10px]">{refsText}</pre>
                ) : null}
              </div>
            ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!loadingRows && !error && catalogMediaEmptyState(rows.length, Boolean(q.trim() || mime.trim()), catalogSourceUnavailable) === "filtered" ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No catalog media matches these filters</p>
          <p className="mt-1 text-xs text-muted-foreground">Clear the search or MIME filter to see all catalog media.</p>
        </div>
      ) : null}
      {!loadingRows && !error && catalogMediaEmptyState(rows.length, Boolean(q.trim() || mime.trim()), catalogSourceUnavailable) === "unavailable" ? (
        <div className="rounded-xl border border-dashed border-amber-300 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Catalog media is temporarily unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">Retry after the product catalog service is available.</p>
        </div>
      ) : null}
      {!loadingRows && !error && rows.length === 0 && catalogMediaEmptyState(rows.length, Boolean(q.trim() || mime.trim()), catalogSourceUnavailable) === "none" ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No catalog media yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Upload an image or video to reuse it across the catalog.</p>
        </div>
      ) : null}
    </div>
  );
}
