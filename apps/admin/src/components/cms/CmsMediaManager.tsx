"use client";

import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { useCallback, useEffect, useRef, useState } from "react";
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

const ACCEPT_ATTR =
  "image/*,video/*,.pdf,.doc,.docx,.zip,.webp,.svg,.mp4,.webm,.mov";
const MAX_BYTES = 25 * 1024 * 1024;

export function CmsMediaManager() {
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(
    session?.user?.permissions ?? [],
    "content:write",
  );
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [mime, setMime] = useState("");
  const [sort, setSort] = useState<
    "created_desc" | "created_asc" | "name_asc" | "name_desc"
  >("created_desc");
  const [tag, setTag] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editTags, setEditTags] = useState("");
  const [refsText, setRefsText] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadingRows(true);
    setError(null);
    const sp = new URLSearchParams();
    sp.set("limit", "200");
    if (q.trim()) sp.set("q", q.trim());
    if (mime.trim()) sp.set("mime", mime.trim());
    sp.set("sort", sort);
    if (tag.trim()) sp.set("tag", tag.trim());
    fetch(`/api/admin/cms/media?${sp.toString()}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: MediaRow[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.data ?? [];
      })
      .then(setRows)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load content"),
      )
      .finally(() => setLoadingRows(false));
  }, [q, mime, sort, tag]);

  useEffect(() => {
    const t = setTimeout(() => load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const uploadFiles = (files: File[]) => {
    if (!files.length || !canWrite) return;
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        setError(
          `"${file.name}" exceeds ${Math.round(MAX_BYTES / (1024 * 1024))} MB.`,
        );
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
          xhr.open("POST", "/api/admin/cms/media");
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
    setDragOver(false);
    if (!canWrite || uploading) return;
    const list = e.dataTransfer.files;
    if (!list?.length) return;
    uploadFiles(Array.from(list));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canWrite && !uploading) setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const openRow = (m: MediaRow) => {
    setOpenId(m.id);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt_text: editAlt || null, tags }),
    });
    if (!r.ok) setError("Update failed");
    else {
      setError(null);
      load();
    }
  };

  const softDelete = async (id: string) => {
    if (
      !confirm(
        "Soft-delete this asset? Storage file remains until purged separately.",
      )
    )
      return;
    const r = await fetch(`/api/admin/cms/media/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    if (!r.ok) setError("Delete failed");
    else {
      setOpenId(null);
      load();
    }
  };

  if (status === "loading")
    return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Search URL</span>
          <input
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="fragment"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-600">MIME prefix</span>
          <input
            className="w-28 rounded border border-slate-200 px-2 py-1 text-sm"
            value={mime}
            onChange={(e) => setMime(e.target.value)}
            placeholder="image/"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Tag</span>
          <input
            className="w-32 rounded border border-slate-200 px-2 py-1 text-sm"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Sort</span>
          <select
            className="rounded border border-slate-200 px-2 py-1 text-sm"
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

      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-slate-300 bg-slate-50/80",
          canWrite && !uploading
            ? "cursor-pointer hover:border-slate-400"
            : "opacity-60",
        ].join(" ")}
      >
        <p className="text-sm font-medium text-slate-800">
          {uploading
            ? `Uploading${uploadPct != null ? ` ${uploadPct}%` : "…"}`
            : "Drop files or click"}
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Max {Math.round(MAX_BYTES / (1024 * 1024))} MB per file. Types:
          images, video, PDF, docs, zip.
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT_ATTR}
          multiple
          disabled={!canWrite || uploading}
          aria-label="Upload media files"
          onChange={(e) => void onFileInput(e.target.files)}
        />
      </label>

      {loadingRows ? (
        <p className="text-sm text-slate-600">Loading media...</p>
      ) : null}
      {!loadingRows && rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No media assets match the current filters.
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2" aria-label="Media assets">
        {rows.map((m) => (
          <li
            key={m.id}
            className="rounded-lg border border-slate-200 p-3 text-sm break-all"
          >
            <button
              type="button"
              className="text-left text-primary underline"
              onClick={() => openRow(m)}
            >
              {m.display_name || m.public_url.slice(-40)}
            </button>
            {sanitizeTrustedPublicUrl(m.public_url) ? <a
              href={sanitizeTrustedPublicUrl(m.public_url) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-xs text-slate-500 underline"
            >
              open
            </a> : null}
            {m.mime_type ? (
              <p className="mt-1 text-[11px] text-slate-500">{m.mime_type}</p>
            ) : null}
            {m.byte_size != null ? (
              <p className="text-[11px] text-slate-500">
                {(m.byte_size / 1024).toFixed(1)} KB
              </p>
            ) : null}
            {m.alt_text ? (
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Alt:</span>{" "}
                {m.alt_text}
              </p>
            ) : null}
            {m.tags?.length ? (
              <p className="text-[11px] text-slate-500">
                Tags: {m.tags.join(", ")}
              </p>
            ) : null}

            {openId === m.id ? (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <label className="block text-xs text-slate-600">
                  Alt text
                  <input
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    value={editAlt}
                    onChange={(e) => setEditAlt(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  Tags (comma-separated)
                  <input
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canWrite}
                    className="rounded bg-primary px-3 py-1 text-xs text-white disabled:opacity-50"
                    onClick={() => void saveMeta(m.id)}
                  >
                    Save meta
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-3 py-1 text-xs"
                    onClick={() => loadRefs(m.id)}
                  >
                    Where used
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite}
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-800 disabled:opacity-50"
                    onClick={() => void softDelete(m.id)}
                  >
                    Soft-delete
                  </button>
                </div>
                {refsText ? (
                  <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[10px]">
                    {refsText}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
