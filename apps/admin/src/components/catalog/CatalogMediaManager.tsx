"use client";

import { staffHasPermission } from "@universal-music-store/platform-data";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { CatalogMediaPreview } from "./CatalogMediaPreview";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";

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

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov|ogg|m4v)$/i.test(file.name);
}

function droppedFiles(dataTransfer: DataTransfer): File[] {
  const itemFiles = Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return itemFiles.length ? itemFiles : Array.from(dataTransfer.files);
}

/** Catalog-scoped media: lists/uploads via `/api/admin/catalog/media`, metadata via CMS media API. */
export function CatalogMediaManager() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(session?.user?.permissions ?? [], "catalog:write");
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [serverCanWrite, setServerCanWrite] = useState(false);
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
    setError(null);
    fetch(`/api/admin/catalog/media?${sp.toString()}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: MediaRow[]; error?: string; canWrite?: boolean };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        setServerCanWrite(Boolean(j.canWrite));
        return j.data ?? [];
      })
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load catalog media"));
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
        setError(`"${file.name}" exceeds ${Math.round(maxBytes / (1024 * 1024))} MB.`);
        return;
      }
    }
    setUploading(true);
    setUploadPct(0);
    setError(null);

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
      setError(e instanceof Error ? e.message : "Upload failed");
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
    void fetch(`/api/admin/cms/media/${id}?refs=1`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: { refs?: unknown } };
        if (!r.ok) return;
        setRefsText(JSON.stringify(j.data?.refs ?? [], null, 2));
      })
      .catch(() => setRefsText("Unable to load references"));
  };

  const saveMeta = async (id: string) => {
    const tags = editTags
      .split(/[,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const r = await fetch(`/api/admin/cms/media/${id}`, {
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
    if (!r.ok) setError("Update failed");
    else {
      setError(null);
      load();
    }
  };

  const softDelete = async (id: string) => {
    if (!confirm("Archive this unused asset? Referenced assets cannot be archived.")) return;
    const r = await fetch(`/api/admin/cms/media/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    if (!r.ok) {
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Archive failed");
    }
    else {
      setOpenId(null);
      load();
    }
  };

  const copyShareLink = async (media: MediaRow) => {
    const url = sanitizeTrustedPublicUrl(media.public_url);
    if (!url || !navigator.clipboard) {
      setError("This asset does not have a safe share URL.");
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopiedId(media.id);
    window.setTimeout(() => setCopiedId((current) => current === media.id ? null : current), 1800);
  };

  if (status === "loading") return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4 text-sm shadow-xs">
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Search media</span>
          <input
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name, alt text, or URL"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-600">MIME prefix</span>
          <input
            className="h-8 w-28 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={mime}
            onChange={(e) => setMime(e.target.value)}
            placeholder="image/"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Sort</span>
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
          "rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
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

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            {m.mime_type ? <p className="mt-1 text-[11px] text-muted-foreground">{m.mime_type}</p> : null}
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
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No catalog media yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Upload an image or video to reuse it across the catalog.</p>
        </div>
      ) : null}
    </div>
  );
}
