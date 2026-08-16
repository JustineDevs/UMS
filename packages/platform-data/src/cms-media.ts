import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

/** Avoid `node:crypto` so this module does not break Webpack when re-exported into client bundles (e.g. SDK). Node 20+ and browsers expose Web Crypto. */
function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}

/** Tag on `cms_media` rows for files in the Supabase `catalog` storage bucket (product PDP assets). */
export const CMS_MEDIA_TAG_CATALOG_PRODUCT = "catalog-product";

export function cmsMediaRowIsCatalogProduct(row: CmsMediaRow): boolean {
  return row.tags.includes(CMS_MEDIA_TAG_CATALOG_PRODUCT);
}

/** Normalize pasted URLs (e.g. protocol-relative) for stable `cms_media.public_url` matching. */
export function normalizeCatalogMediaUrlForDb(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  try {
    if (t.startsWith("//")) {
      return new URL(`https:${t}`).href;
    }
    return new URL(t).href;
  } catch {
    return null;
  }
}

export function isCatalogMediaUrlAllowed(normalized: string): boolean {
  try {
    const u = new URL(normalized);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.")
    ) return false;
    const private172 = host.match(/^172\.(\d+)\./);
    return !(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
  } catch {
    return false;
  }
}

function guessCatalogMediaMimeFromUrl(url: string): string | null {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();
  if (/\.(jpe?g)(\?|$)/i.test(path)) return "image/jpeg";
  if (/\.png(\?|$)/i.test(path)) return "image/png";
  if (/\.gif(\?|$)/i.test(path)) return "image/gif";
  if (/\.webp(\?|$)/i.test(path)) return "image/webp";
  if (/\.avif(\?|$)/i.test(path)) return "image/avif";
  if (/\.svg(\?|$)/i.test(path)) return "image/svg+xml";
  if (/\.bmp(\?|$)/i.test(path)) return "image/bmp";
  if (/\.(mp4|m4v)(\?|$)/i.test(path)) return "video/mp4";
  if (/\.webm(\?|$)/i.test(path)) return "video/webm";
  if (/\.(mov|qt)(\?|$)/i.test(path)) return "video/quicktime";
  if (/\.ogg(\?|$)/i.test(path)) return "video/ogg";
  return null;
}

function displayNameFromCatalogUrl(url: string): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split("/").filter(Boolean).pop();
    if (base && base.length <= 120) return base;
    return u.hostname || "external";
  } catch {
    return "external";
  }
}

export async function findCmsMediaCatalogProductByPublicUrl(
  supabase: SupabaseClient,
  publicUrl: string,
  organizationId?: string,
): Promise<CmsMediaRow | null> {
  let query = supabase
    .from("cms_media")
    .select("*")
    .eq("public_url", publicUrl)
    .contains("tags", [CMS_MEDIA_TAG_CATALOG_PRODUCT])
    .is("deleted_at", null)
    .limit(1);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-media] findCatalogByPublicUrl", error.message);
    return null;
  }
  const first = data?.[0];
  if (!first) return null;
  return mapRow(first as Record<string, unknown>);
}

/**
 * Ensures each HTTP(S) media URL used on a catalog product has a matching `cms_media` row
 * tagged `catalog-product`. Skips URLs already present; skips non-absolute URLs (e.g. site-relative paths).
 * Uploads to Supabase Storage already inserted a row with the same `public_url` — those are skipped.
 */
export async function ensureExternalCatalogProductMediaRows(
  supabase: SupabaseClient,
  rawUrls: string[],
  organizationId?: string,
): Promise<void> {
  const dedup = new Set<string>();
  for (const raw of rawUrls) {
    const normalized = normalizeCatalogMediaUrlForDb(raw);
    if (!normalized || !isCatalogMediaUrlAllowed(normalized)) continue;
    if (dedup.has(normalized)) continue;
    dedup.add(normalized);

    const existing = await findCmsMediaCatalogProductByPublicUrl(supabase, normalized, organizationId);
    if (existing) continue;

    const row = await insertCmsMedia(supabase, {
      storage_path: `external/${randomUuid()}`,
      public_url: normalized,
      alt_text: null,
      mime_type: guessCatalogMediaMimeFromUrl(normalized),
      width: null,
      height: null,
      display_name: displayNameFromCatalogUrl(normalized),
      byte_size: null,
      tags: [CMS_MEDIA_TAG_CATALOG_PRODUCT],
      organization_id: organizationId ?? null,
    });
    if (!row) {
      console.error("[cms-media] ensureExternalCatalogProductMediaRows insert failed", normalized);
    }
  }
}

export type CmsMediaRow = {
  id: string;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  deleted_at: string | null;
  display_name: string | null;
  byte_size: number | null;
  tags: string[];
  organization_id: string | null;
};

export type ListCmsMediaOptions = {
  limit?: number;
  search?: string;
  mimePrefix?: string;
  sort?: "created_desc" | "created_asc" | "name_asc" | "name_desc";
  includeDeleted?: boolean;
  tag?: string;
  organizationId?: string;
};

function mapRow(x: Record<string, unknown>): CmsMediaRow {
  const tags = x.tags;
  return {
    id: String(x.id),
    storage_path: String(x.storage_path ?? ""),
    public_url: String(x.public_url ?? ""),
    alt_text: x.alt_text != null ? String(x.alt_text) : null,
    mime_type: x.mime_type != null ? String(x.mime_type) : null,
    width: typeof x.width === "number" ? x.width : null,
    height: typeof x.height === "number" ? x.height : null,
    created_at: String(x.created_at ?? ""),
    deleted_at: x.deleted_at != null ? String(x.deleted_at) : null,
    display_name: x.display_name != null ? String(x.display_name) : null,
    byte_size: typeof x.byte_size === "number" ? x.byte_size : x.byte_size != null ? Number(x.byte_size) : null,
    tags: Array.isArray(tags) ? tags.map(String) : [],
    organization_id: typeof x.organization_id === "string" ? x.organization_id : null,
  };
}

export async function listCmsMedia(
  supabase: SupabaseClient,
  limitOrOpts: number | ListCmsMediaOptions = 100,
): Promise<CmsMediaRow[]> {
  const opts: ListCmsMediaOptions =
    typeof limitOrOpts === "number" ? { limit: limitOrOpts } : limitOrOpts;
  const limit = opts.limit ?? 100;
  let q = supabase.from("cms_media").select("*");
  if (!opts.includeDeleted) {
    q = q.is("deleted_at", null);
  }
  if (opts.search?.trim()) {
    const search = opts.search.trim().replace(/[(),]/g, " ");
    q = q.or(
      `public_url.ilike.%${search}%,display_name.ilike.%${search}%,alt_text.ilike.%${search}%`,
    );
  }
  if (opts.mimePrefix?.trim()) {
    q = q.ilike("mime_type", `${opts.mimePrefix.trim()}%`);
  }
  if (opts.tag?.trim()) {
    q = q.contains("tags", [opts.tag.trim()]);
  }
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);
  const sort = opts.sort ?? "created_desc";
  if (sort === "created_asc") q = q.order("created_at", { ascending: true });
  else if (sort === "name_asc") q = q.order("display_name", { ascending: true, nullsFirst: false });
  else if (sort === "name_desc") q = q.order("display_name", { ascending: false, nullsFirst: true });
  else q = q.order("created_at", { ascending: false });
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-media] list", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getCmsMediaById(
  supabase: SupabaseClient,
  id: string,
  organizationId?: string,
): Promise<CmsMediaRow | null> {
  let query = supabase.from("cms_media").select("*").eq("id", id);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-media] getById", error.message);
    return null;
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function insertCmsMedia(
  supabase: SupabaseClient,
  row: Omit<CmsMediaRow, "id" | "created_at" | "deleted_at" | "tags" | "organization_id"> & {
    tags?: string[];
    organization_id?: string | null;
    byte_size?: number | null;
    display_name?: string | null;
  },
): Promise<CmsMediaRow | null> {
  const { data, error } = await supabase
    .from("cms_media")
    .insert({
      storage_path: row.storage_path,
      public_url: row.public_url,
      alt_text: row.alt_text,
      mime_type: row.mime_type,
      width: row.width,
      height: row.height,
      display_name: row.display_name ?? null,
      byte_size: row.byte_size ?? null,
      tags: row.tags ?? [],
      organization_id: row.organization_id ?? null,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    console.error("[cms-media] insert", error.message);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function updateCmsMedia(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<CmsMediaRow, "alt_text" | "display_name" | "tags">>,
  organizationId?: string,
): Promise<CmsMediaRow | null> {
  const payload: Record<string, unknown> = {};
  if (patch.alt_text !== undefined) payload.alt_text = patch.alt_text;
  if (patch.display_name !== undefined) payload.display_name = patch.display_name;
  if (patch.tags !== undefined) payload.tags = patch.tags;
  if (Object.keys(payload).length === 0) return getCmsMediaById(supabase, id, organizationId);
  let query = supabase
    .from("cms_media")
    .update(payload)
    .eq("id", id)
    .select("*");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.single();
  if (error) {
    console.error("[cms-media] update", error.message);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function softDeleteCmsMedia(supabase: SupabaseClient, id: string, organizationId?: string): Promise<boolean> {
  let query = supabase
    .from("cms_media")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { error } = await query;
  if (error) {
    console.error("[cms-media] softDelete", error.message);
    return false;
  }
  return true;
}

export type CmsMediaReferenceHit = { source: string; detail: string };

/** Best-effort text scan for public_url across CMS tables (admin only). */
export async function findCmsMediaReferences(
  supabase: SupabaseClient,
  publicUrl: string,
  organizationId?: string,
): Promise<CmsMediaReferenceHit[]> {
  const hits: CmsMediaReferenceHit[] = [];
  const needle = publicUrl.trim();
  if (!needle) return hits;

  let pagesQuery = supabase.from("cms_pages").select("id, slug, locale, body, og_image_url");
  if (organizationId) pagesQuery = pagesQuery.eq("organization_id", organizationId);
  const { data: pages } = await pagesQuery;
  for (const p of pages ?? []) {
    const r = p as Record<string, unknown>;
    const blob = `${r.body ?? ""} ${r.og_image_url ?? ""}`;
    if (blob.includes(needle)) {
      hits.push({
        source: "cms_pages",
        detail: `${String(r.slug ?? "")} (${String(r.locale ?? "")})`,
      });
    }
  }

  let catsQuery = supabase
    .from("cms_category_content")
    .select("collection_handle, locale, intro_html, banner_url, blocks");
  if (organizationId) catsQuery = catsQuery.eq("organization_id", organizationId);
  const { data: cats } = await catsQuery;
  for (const c of cats ?? []) {
    const r = c as Record<string, unknown>;
    const blob = JSON.stringify(r);
    if (blob.includes(needle)) {
      hits.push({
        source: "cms_category_content",
        detail: `${String(r.collection_handle ?? "")} (${String(r.locale ?? "")})`,
      });
    }
  }

  let postsQuery = supabase
    .from("cms_blog_posts")
    .select("slug, locale, body, excerpt, cover_image_url, og_image_url");
  if (organizationId) postsQuery = postsQuery.eq("organization_id", organizationId);
  const { data: posts } = await postsQuery;
  for (const p of posts ?? []) {
    const r = p as Record<string, unknown>;
    const blob = `${r.body ?? ""}${r.excerpt ?? ""}${r.cover_image_url ?? ""}${r.og_image_url ?? ""}`;
    if (blob.includes(needle)) {
      hits.push({ source: "cms_blog_posts", detail: `${String(r.slug ?? "")} (${String(r.locale ?? "")})` });
    }
  }

  let navQuery = supabase.from("cms_navigation").select("id, header_links, footer_columns");
  if (organizationId) navQuery = navQuery.eq("organization_id", organizationId);
  const { data: nav } = await navQuery;
  for (const n of nav ?? []) {
    const r = n as Record<string, unknown>;
    if (JSON.stringify(r).includes(needle)) {
      hits.push({ source: "cms_navigation", detail: String(r.id ?? "default") });
    }
  }

  let componentsQuery = supabase
    .from("cms_component_definitions")
    .select("id, component_key, definition");
  if (organizationId) componentsQuery = componentsQuery.eq("organization_id", organizationId);
  const { data: components } = await componentsQuery;
  for (const component of components ?? []) {
    const row = component as Record<string, unknown>;
    if (JSON.stringify(row).includes(needle)) {
      hits.push({ source: "cms_component_definitions", detail: `${String(row.component_key ?? row.id ?? "component")}` });
    }
  }

  const { data: home } = await supabase.from("storefront_home_content").select("id, payload");
  for (const entry of home ?? []) {
    const row = entry as Record<string, unknown>;
    if (JSON.stringify(row).includes(needle)) {
      hits.push({ source: "storefront_home_content", detail: String(row.id ?? "default") });
    }
  }

  return hits;
}
