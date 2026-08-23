"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { staffHasPermission } from "@universal-music-store/platform-data";
import { useCallback, useEffect, useState } from "react";
import { CatalogMediaPickerDialog } from "@/components/catalog/CatalogMediaPickerDialog";
import { getStorefrontPublicOrigin } from "@/lib/storefront-public-url";
import { cmsMutationHeaders } from "@/lib/cms-mutation-headers";

type Post = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  author_name: string | null;
  tags: string[];
  status: string;
  published_at: string | null;
  scheduled_publish_at: string | null;
  preview_token: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
  rss_include: boolean;
};

export function CmsBlogEditor({ postId }: { postId: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const canWrite = staffHasPermission(
    session?.user?.permissions ?? [],
    "content:write",
  );
  const [row, setRow] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const siteBase = getStorefrontPublicOrigin();

  const load = useCallback(() => {
    fetch(`/api/admin/cms/blog/${postId}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: Post; error?: string };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.data ?? null;
      })
      .then((p) => {
        setRow(p);
        if (p) setTagsInput(p.tags.join(", "));
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      );
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!row || !canWrite) return;
    setSaving(true);
    setError(null);
    const tags = tagsInput
      .split(/[,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const r = await fetch(`/api/admin/cms/blog/${postId}`, {
      method: "PUT",
      headers: cmsMutationHeaders(),
      body: JSON.stringify({
        ...row,
        tags,
      }),
    });
    const j = (await r.json()) as { error?: string; data?: Post };
    setSaving(false);
    if (!r.ok) {
      setError(j.error ?? "Save failed");
      return;
    }
    if (j.data) setRow(j.data);
  };

  const genPreviewToken = () => {
    if (!row) return;
    const t =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
        : String(Date.now());
    setRow({ ...row, preview_token: t });
  };

  if (status === "loading" || !row) {
    return <p className="text-sm text-slate-600">{error ?? "Loading…"}</p>;
  }

  const previewUrl =
    siteBase && row.preview_token
      ? `${siteBase}/blog/preview?slug=${encodeURIComponent(row.slug)}&locale=${encodeURIComponent(row.locale)}&token=${encodeURIComponent(row.preview_token)}`
      : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/cms/blog" className="text-sm text-primary underline">
          Back to list
        </Link>
        {siteBase ? (
          <a
            href={`${siteBase}/blog/${encodeURIComponent(row.slug)}`}
            className="text-sm text-slate-600 underline"
            target="_blank"
            rel="noreferrer"
          >
            View live
          </a>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <label className="block text-xs font-medium text-slate-600">
        Title
        <input
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={row.title}
          onChange={(e) => setRow({ ...row, title: e.target.value })}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          Slug
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={row.slug}
            onChange={(e) => setRow({ ...row, slug: e.target.value })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Locale
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={row.locale}
            onChange={(e) => setRow({ ...row, locale: e.target.value })}
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        Status
        <select
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={row.status}
          onChange={(e) => setRow({ ...row, status: e.target.value })}
        >
          <option value="draft">draft</option>
          <option value="published">published</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Scheduled publish (ISO datetime, empty to clear)
        <input
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono"
          value={row.scheduled_publish_at ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              scheduled_publish_at: e.target.value.trim() || null,
            })
          }
          placeholder="2026-04-01T12:00:00.000Z"
        />
      </label>
      <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
        <p className="font-medium text-slate-800">Preview token</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            readOnly
            className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 font-mono text-[11px]"
            value={row.preview_token ?? ""}
          />
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1"
            onClick={genPreviewToken}
            disabled={!canWrite}
          >
            Generate
          </button>
        </div>
        {previewUrl ? (
          <a
            href={previewUrl}
            className="mt-2 inline-block text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            Open preview
          </a>
        ) : (
          <p className="mt-2">
            Generate a token for a storefront preview link.
          </p>
        )}
      </div>

      <label className="block text-xs font-medium text-slate-600">
        Excerpt
        <textarea
          className="mt-1 w-full min-h-[72px] rounded border border-slate-200 px-3 py-2 text-sm"
          value={row.excerpt}
          onChange={(e) => setRow({ ...row, excerpt: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Body (HTML)
        <textarea
          className="mt-1 w-full min-h-[200px] rounded border border-slate-200 px-3 py-2 font-mono text-sm"
          value={row.body}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
        />
      </label>

      <label className="block text-xs font-medium text-slate-600">
        Cover image URL
        <input
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={row.cover_image_url ?? ""}
          onChange={(e) =>
            setRow({ ...row, cover_image_url: e.target.value || null })
          }
        />
      </label>
      <button
        type="button"
        className="text-xs text-primary underline"
        onClick={() => setMediaPickerOpen(true)}
      >
        Pick from media library
      </button>

      <label className="block text-xs font-medium text-slate-600">
        Author name
        <input
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={row.author_name ?? ""}
          onChange={(e) =>
            setRow({ ...row, author_name: e.target.value || null })
          }
        />
      </label>

      <CatalogMediaPickerDialog
        open={mediaPickerOpen}
        mediaScope="cms"
        addPlacement="main"
        onAddPlacementChange={() => undefined}
        onClose={() => setMediaPickerOpen(false)}
        onPickMany={(media) => {
          const coverImageUrl = media[0]?.public_url;
          if (coverImageUrl) setRow({ ...row, cover_image_url: coverImageUrl });
        }}
      />
      <label className="block text-xs font-medium text-slate-600">
        Tags (comma-separated)
        <input
          className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
      </label>

      <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-800">
          RSS and SEO
        </legend>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={row.rss_include}
            onChange={(e) => setRow({ ...row, rss_include: e.target.checked })}
          />
          Include in RSS
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Meta title
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={row.meta_title ?? ""}
            onChange={(e) =>
              setRow({ ...row, meta_title: e.target.value || null })
            }
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Meta description
          <textarea
            className="mt-1 w-full min-h-[60px] rounded border border-slate-200 px-3 py-2 text-sm"
            value={row.meta_description ?? ""}
            onChange={(e) =>
              setRow({ ...row, meta_description: e.target.value || null })
            }
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Canonical URL
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={row.canonical_url ?? ""}
            onChange={(e) =>
              setRow({ ...row, canonical_url: e.target.value || null })
            }
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Open Graph image URL
          <input
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={row.og_image_url ?? ""}
            onChange={(e) =>
              setRow({ ...row, og_image_url: e.target.value || null })
            }
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canWrite || saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={!canWrite}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-800"
          onClick={async () => {
            if (!confirm("Delete this post?")) return;
            const r = await fetch(`/api/admin/cms/blog/${postId}`, {
              method: "DELETE",
              headers: cmsMutationHeaders(),
            });
            if (r.ok) router.push("/admin/cms/blog");
            else setError("Delete failed");
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
