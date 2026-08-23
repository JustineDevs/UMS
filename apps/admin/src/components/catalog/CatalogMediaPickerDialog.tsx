"use client";

import { staffHasPermission } from "@universal-music-store/platform-data";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CatalogMediaPreview } from "./CatalogMediaPreview";

type MediaRow = {
  id: string;
  public_url: string;
  display_name: string | null;
  mime_type: string | null;
  alt_text?: string | null;
  byte_size?: number | null;
};
export type PickedMedia = Pick<MediaRow, "id" | "public_url">;

export type CatalogAddPlacement = "main" | "gallery";

type Props = {
  open: boolean;
  onClose: () => void;
  addPlacement: CatalogAddPlacement;
  onAddPlacementChange: (_placement: CatalogAddPlacement) => void;
  onPickMany: (_media: PickedMedia[]) => void;
  mediaScope?: "catalog" | "cms";
};

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function videoExtOk(name: string): boolean {
  return /\.(mp4|webm|mov|ogg)$/i.test(name);
}

export function CatalogMediaPickerDialog({
  open,
  onClose,
  addPlacement,
  onAddPlacementChange,
  onPickMany,
  mediaScope = "catalog",
}: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const writePermission = mediaScope === "cms" ? "content:write" : "catalog:write";
  const mediaApiPath = mediaScope === "cms" ? "/api/admin/cms/media" : "/api/admin/catalog/media";
  const mediaPagePath = mediaScope === "cms" ? "/admin/cms/media" : "/admin/catalog/media";
  const canWrite = staffHasPermission(
    session?.user?.permissions ?? [],
    writePermission,
  );

  const [rows, setRows] = useState<MediaRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [serverCanWrite, setServerCanWrite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAlt, setEditAlt] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    sp.set("limit", "120");
    sp.set("sort", "created_desc");
    if (q.trim()) sp.set("q", q.trim());
    fetch(`${mediaApiPath}?${sp.toString()}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: MediaRow[]; error?: string; canWrite?: boolean };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        setServerCanWrite(Boolean(j.canWrite));
        return j.data ?? [];
      })
      .then(setRows)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      )
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(), 200);
    return () => clearTimeout(t);
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setRows([]);
      setError(null);
      setSelectedIds(new Set());
      setEditingId(null);
    }
  }, [open]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addSelected = useCallback(() => {
    const media = rows
      .filter((m) => selectedIds.has(m.id))
      .filter((m) => m.public_url.trim())
      .map(({ id, public_url }) => ({ id, public_url }));
    if (media.length === 0) return;
    onPickMany(media);
    onClose();
  }, [rows, selectedIds, onPickMany, onClose]);

  const openEdit = (m: MediaRow) => {
    setEditingId(m.id);
    setEditDisplayName(m.display_name?.trim() ?? "");
    setEditAlt(typeof m.alt_text === "string" ? m.alt_text : "");
  };

  const saveMeta = async (id: string) => {
    setSavingMeta(true);
    setError(null);
    try {
      const r = await fetch(`${mediaApiPath}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          display_name: editDisplayName.trim() || null,
          alt_text: editAlt.trim() || null,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Update failed");
      setEditingId(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingMeta(false);
    }
  };

  const softDelete = async (id: string) => {
    if (
      !confirm(
        "Remove this asset from the library? The storage file stays until purged separately.",
      )
    ) {
      return;
    }
    setError(null);
    try {
      const r = await fetch(`${mediaApiPath}/${id}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Delete failed");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setEditingId(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const uploadFile = async (file: File) => {
    const mime = file.type || "";
    const name = file.name || "";
    const isImage = mime.startsWith("image/");
    const isVideo =
      mime.startsWith("video/") ||
      ((mime === "" || mime === "application/octet-stream") && videoExtOk(name));
    if (!isImage && !isVideo) {
      setError("Only image or video files can be uploaded here.");
      return;
    }
    const max = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > max) {
      setError(`File exceeds ${Math.round(max / (1024 * 1024))} MB.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("alt", file.name);
      const r = await fetch(mediaApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: fd,
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Upload failed");
      load();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  const n = selectedIds.size;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="catalog-media-picker-title"
      aria-describedby="catalog-media-picker-desc"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-xl"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/20 px-5 py-4">
          <div>
            <h2
              id="catalog-media-picker-title"
              className="text-base font-semibold text-on-surface"
            >
              {mediaScope === "cms" ? "Content media library" : "Catalog media library"}
            </h2>
            <p
              id="catalog-media-picker-desc"
              className="mt-1 text-xs leading-relaxed text-on-surface-variant"
            >
              Preview images and videos, upload new files, or edit names. Select items to add them
              {mediaScope === "cms"
                ? "Preview, upload, and select reusable content media."
                : "Preview images and videos, upload new files, or edit names. Select items to add them to this product."}
            </p>
            <p className="mt-2 text-xs">
              <Link
                href={mediaPagePath}
                className="font-medium text-primary underline"
                onClick={onClose}
              >
              Open full media library
              </Link>{" "}
              for advanced filters and bulk work.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {(canWrite || serverCanWrite) && (sessionStatus === "authenticated" || serverCanWrite) ? (
          <div className="border-b border-outline-variant/20 px-5 py-3">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept="image/*,video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov"
              disabled={uploading}
              aria-label="Upload file to catalog library"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              className="rounded-lg border border-outline-variant/30 bg-white px-4 py-2 text-sm font-medium text-on-surface disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload to library"}
            </button>
            <p className="mt-1 text-[11px] text-on-surface-variant">
              Images up to 25 MB, video up to 100 MB. Stored in the catalog bucket with a stable
              URL.
            </p>
          </div>
        ) : null}

        <div
          className="border-b border-outline-variant/20 px-5 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Add selected to product
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="catalog-add-placement"
                checked={addPlacement === "main"}
                onChange={() => onAddPlacementChange("main")}
              />
              <span>Main photos</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="catalog-add-placement"
                checked={addPlacement === "gallery"}
                onChange={() => onAddPlacementChange("gallery")}
              />
              <span>Gallery</span>
            </label>
          </div>
        </div>

        <div className="border-b border-outline-variant/20 px-5 py-3">
          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Search (URL fragment)
          </label>
          <input
            type="search"
            className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by URL"
            autoComplete="off"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              No files yet. Upload above or open Catalog media.
            </p>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((m) => {
              const checked = selectedIds.has(m.id);
              const title = m.display_name?.trim() || "Untitled file";
              const isEditing = editingId === m.id;
              return (
                <li
                  key={m.id}
                  className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-high/80"
                >
                  <div className="relative aspect-[4/3] w-full bg-surface-container-highest">
                    <CatalogMediaPreview
                      publicUrl={m.public_url}
                      mimeType={m.mime_type}
                      className="h-full w-full object-cover"
                      fallbackLabel={title}
                    />
                    <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs text-white">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-white/80"
                        checked={checked}
                        onChange={() => toggle(m.id)}
                      />
                      Select
                    </label>
                  </div>
                  <div className="space-y-2 p-3 text-sm">
                    <p className="line-clamp-2 font-medium text-on-surface" title={title}>
                      {title}
                    </p>
                    {m.mime_type ? (
                      <p className="text-[11px] text-on-surface-variant">{m.mime_type}</p>
                    ) : null}
                    {m.byte_size != null ? (
                      <p className="text-[11px] text-on-surface-variant">
                        {(m.byte_size / 1024).toFixed(1)} KB
                      </p>
                    ) : null}
                    {canWrite || serverCanWrite ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {isEditing ? (
                          <>
                            <label className="block w-full text-[11px] text-on-surface-variant">
                              Display name
                              <input
                                className="mt-1 w-full rounded border border-outline-variant/30 px-2 py-1 text-sm text-on-surface"
                                value={editDisplayName}
                                onChange={(e) => setEditDisplayName(e.target.value)}
                                maxLength={200}
                              />
                            </label>
                            <label className="block w-full text-[11px] text-on-surface-variant">
                              Alt text
                              <input
                                className="mt-1 w-full rounded border border-outline-variant/30 px-2 py-1 text-sm text-on-surface"
                                value={editAlt}
                                onChange={(e) => setEditAlt(e.target.value)}
                                maxLength={500}
                              />
                            </label>
                            <button
                              type="button"
                              disabled={savingMeta}
                              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              onClick={() => void saveMeta(m.id)}
                            >
                              {savingMeta ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-outline-variant/30 px-3 py-1 text-xs"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="rounded-md border border-outline-variant/30 px-3 py-1 text-xs"
                              onClick={() => openEdit(m)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-800"
                              onClick={() => void softDelete(m.id)}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="border-t border-outline-variant/20 px-5 py-4">
          <button
            type="button"
            disabled={n === 0}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            onClick={addSelected}
          >
            Add selected to product{n > 0 ? ` (${n})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
