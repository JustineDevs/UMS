import type { SupabaseClient } from "@supabase/supabase-js";
import { isCmsPubliclyVisible } from "./cms-public-visibility.js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";
import type {
  CmsBlock,
  CmsComponentInstance,
  CmsPageRow,
  CmsPageType,
  CmsPublishStatus,
} from "./cms-types.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseStringRecord(v: unknown): Record<string, string> | undefined {
  if (!isRecord(v)) return undefined;
  return Object.fromEntries(
    Object.entries(v).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function parseComponentInstances(v: unknown, path = "root"): CmsComponentInstance[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const componentId =
      typeof item.componentId === "string" && item.componentId.trim()
        ? item.componentId
        : "";
    if (!componentId) return [];
    const slots = isRecord(item.slots)
      ? Object.fromEntries(
          Object.entries(item.slots).map(([slot, children]) => [
            slot,
            parseComponentInstances(children, `${path}.${index}.${slot}`),
          ]),
        )
      : {};
    return [
      {
        id:
          typeof item.id === "string" && item.id
            ? item.id
            : `cmp_${path}_${index}`,
        componentId,
        variantId: typeof item.variantId === "string" ? item.variantId : undefined,
        props: isRecord(item.props) ? item.props : {},
        slots,
        styleOverrides: parseStringRecord(item.styleOverrides),
        lockedStructure:
          typeof item.lockedStructure === "boolean" ? item.lockedStructure : undefined,
      },
    ];
  });
}

function parseSlots(v: unknown, path: string): CmsBlock["slots"] | undefined {
  if (!isRecord(v)) return undefined;
  return Object.fromEntries(
    Object.entries(v).map(([slot, instances]) => [
      slot,
      parseComponentInstances(instances, `${path}.${slot}`),
    ]),
  );
}

function parseBlocks(v: unknown): CmsBlock[] {
  if (!Array.isArray(v)) return [];
  const out: CmsBlock[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const id =
      typeof item.id === "string"
        ? item.id
        : `blk_${out.length}`;
    const type = typeof item.type === "string" ? item.type : "unknown";
    const props = isRecord(item.props) ? item.props : {};
    out.push({
      id,
      type,
      props,
      componentId: typeof item.componentId === "string" ? item.componentId : undefined,
      variantId: typeof item.variantId === "string" ? item.variantId : undefined,
      slots: parseSlots(item.slots, id),
      styleOverrides: parseStringRecord(item.styleOverrides),
    });
  }
  return out;
}

function rowToPage(r: Record<string, unknown>): CmsPageRow {
  return {
    id: String(r.id),
    organization_id: r.organization_id != null ? String(r.organization_id) : null,
    slug: String(r.slug ?? ""),
    locale: String(r.locale ?? "en"),
    page_type: (r.page_type as CmsPageType) ?? "static",
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    blocks: parseBlocks(r.blocks),
    status: (r.status as CmsPublishStatus) ?? "draft",
    published_at: r.published_at != null ? String(r.published_at) : null,
    scheduled_publish_at:
      r.scheduled_publish_at != null ? String(r.scheduled_publish_at) : null,
    preview_token: r.preview_token != null ? String(r.preview_token) : null,
    meta_title: r.meta_title != null ? String(r.meta_title) : null,
    meta_description: r.meta_description != null ? String(r.meta_description) : null,
    canonical_url: r.canonical_url != null ? String(r.canonical_url) : null,
    og_image_url: r.og_image_url != null ? String(r.og_image_url) : null,
    json_ld: r.json_ld ?? null,
    version: typeof r.version === "number" ? r.version : Number(r.version) || 1,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
    parent_slug: r.parent_slug != null ? String(r.parent_slug) : null,
    breadcrumb_label: r.breadcrumb_label != null ? String(r.breadcrumb_label) : null,
  };
}

export async function listCmsPages(
  supabase: SupabaseClient,
  opts?: { locale?: string; organizationId?: string },
): Promise<CmsPageRow[]> {
  let q = supabase.from("cms_pages").select("*").order("updated_at", { ascending: false });
  if (opts?.locale) q = q.eq("locale", opts.locale);
  if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data, error } = await q;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-pages] listCmsPages", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToPage(r as Record<string, unknown>));
}

export async function getCmsPageById(
  supabase: SupabaseClient,
  id: string,
  organizationId?: string,
): Promise<CmsPageRow | null> {
  let q = supabase.from("cms_pages").select("*").eq("id", id);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-pages] getCmsPageById", error.message);
    return null;
  }
  if (!data) return null;
  return rowToPage(data as Record<string, unknown>);
}

export async function getCmsPageBySlugLocalePublic(
  supabase: SupabaseClient,
  slug: string,
  locale: string,
  organizationId?: string,
): Promise<CmsPageRow | null> {
  let query = supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", slug)
    .eq("locale", locale);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-pages] getCmsPageBySlugLocalePublic", error.message);
    return null;
  }
  if (!data) return null;
  const page = rowToPage(data as Record<string, unknown>);
  if (!isCmsPubliclyVisible(page.status, page.scheduled_publish_at)) {
    return null;
  }
  return page;
}

export async function listCmsPagesForSitemapPublic(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<{ slug: string; locale: string; updated_at: string }[]> {
  let query = supabase
    .from("cms_pages")
    .select("slug, locale, updated_at, status, scheduled_publish_at");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-pages] listCmsPagesForSitemapPublic", error.message);
    return [];
  }
  const now = Date.now();
  return (data ?? [])
    .map((r) => {
      const x = r as Record<string, unknown>;
      return {
        slug: String(x.slug ?? ""),
        locale: String(x.locale ?? "en"),
        updated_at: String(x.updated_at ?? ""),
        status: (x.status as CmsPageRow["status"]) ?? "draft",
        scheduled_publish_at:
          x.scheduled_publish_at != null ? String(x.scheduled_publish_at) : null,
      };
    })
    .filter((r) => isCmsPubliclyVisible(r.status, r.scheduled_publish_at, now))
    .map(({ slug, locale, updated_at }) => ({ slug, locale, updated_at }));
}

export async function getCmsPageBySlugAdmin(
  supabase: SupabaseClient,
  slug: string,
  locale: string,
  organizationId?: string,
): Promise<CmsPageRow | null> {
  let q = supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", slug)
    .eq("locale", locale);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-pages] getCmsPageBySlugAdmin", error.message);
    return null;
  }
  if (!data) return null;
  return rowToPage(data as Record<string, unknown>);
}

export type UpsertCmsPageInput = {
  organization_id?: string;
  id?: string;
  slug: string;
  locale?: string;
  page_type?: CmsPageType;
  title?: string;
  body?: string;
  blocks?: CmsBlock[];
  status?: CmsPublishStatus;
  published_at?: string | null;
  scheduled_publish_at?: string | null;
  preview_token?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_image_url?: string | null;
  json_ld?: unknown | null;
  parent_slug?: string | null;
  breadcrumb_label?: string | null;
};

export async function upsertCmsPage(
  supabase: SupabaseClient,
  input: UpsertCmsPageInput,
): Promise<CmsPageRow | null> {
  const locale = input.locale ?? "en";
  const existing = input.id
    ? await getCmsPageById(supabase, input.id, input.organization_id)
    : await getCmsPageBySlugAdmin(supabase, input.slug, locale, input.organization_id);

  if (existing) {
    const snapshot = { ...existing, blocks: existing.blocks };
    await supabase.from("cms_page_versions").insert({
      page_id: existing.id,
      snapshot: snapshot as unknown as Record<string, unknown>,
    });
  }

  const nextVersion = existing ? existing.version + 1 : 1;
  const row = {
    organization_id: input.organization_id ?? existing?.organization_id ?? null,
    slug: input.slug,
    locale,
    page_type: input.page_type ?? existing?.page_type ?? "static",
    title: input.title ?? existing?.title ?? "",
    body: input.body ?? existing?.body ?? "",
    blocks: (input.blocks ?? existing?.blocks ?? []) as unknown as Record<string, unknown>[],
    status: input.status ?? existing?.status ?? "draft",
    published_at: input.published_at !== undefined ? input.published_at : existing?.published_at ?? null,
    scheduled_publish_at:
      input.scheduled_publish_at !== undefined
        ? input.scheduled_publish_at
        : existing?.scheduled_publish_at ?? null,
    preview_token:
      input.preview_token !== undefined ? input.preview_token : existing?.preview_token ?? null,
    meta_title: input.meta_title !== undefined ? input.meta_title : existing?.meta_title ?? null,
    meta_description:
      input.meta_description !== undefined
        ? input.meta_description
        : existing?.meta_description ?? null,
    canonical_url:
      input.canonical_url !== undefined ? input.canonical_url : existing?.canonical_url ?? null,
    og_image_url: input.og_image_url !== undefined ? input.og_image_url : existing?.og_image_url ?? null,
    json_ld: input.json_ld !== undefined ? input.json_ld : existing?.json_ld ?? null,
    parent_slug:
      input.parent_slug !== undefined
        ? input.parent_slug
        : existing?.parent_slug ?? null,
    breadcrumb_label:
      input.breadcrumb_label !== undefined
        ? input.breadcrumb_label
        : existing?.breadcrumb_label ?? null,
    version: nextVersion,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("cms_pages")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) {
      console.error("[cms-pages] upsertCmsPage update", error.message);
      return null;
    }
    return rowToPage(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("cms_pages")
    .insert({
      ...row,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    console.error("[cms-pages] upsertCmsPage insert", error.message);
    return null;
  }
  return rowToPage(data as Record<string, unknown>);
}

export async function deleteCmsPage(
  supabase: SupabaseClient,
  id: string,
  organizationId?: string,
): Promise<boolean> {
  let q = supabase.from("cms_pages").delete().eq("id", id);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { error } = await q;
  if (error) {
    console.error("[cms-pages] deleteCmsPage", error.message);
    return false;
  }
  return true;
}

export async function listCmsPageVersions(supabase: SupabaseClient, pageId: string) {
  const { data, error } = await supabase
    .from("cms_page_versions")
    .select("id, created_at, snapshot")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-pages] listCmsPageVersions", error.message);
    return [];
  }
  return data ?? [];
}

export async function getCmsPageBySlugPreview(
  supabase: SupabaseClient,
  slug: string,
  locale: string,
  previewToken: string,
  organizationId?: string,
): Promise<CmsPageRow | null> {
  let query = supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", slug)
    .eq("locale", locale)
    .eq("preview_token", previewToken);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-pages] getCmsPageBySlugPreview", error.message);
    return null;
  }
  if (!data) return null;
  return rowToPage(data as Record<string, unknown>);
}

/**
 * Breadcrumb trail for published ancestors only, starting from a parent slug (excludes the leaf page).
 * Use with a preview or draft leaf row to build full crumbs: `[...ancestors, leafCrumb]`.
 */
export async function getCmsPageAncestorTrail(
  supabase: SupabaseClient,
  startParentSlug: string | null | undefined,
  locale: string,
  maxDepth = 8,
): Promise<{ label: string; href: string }[]> {
  const crumbs: { label: string; href: string }[] = [];
  let currentSlug: string | null =
    typeof startParentSlug === "string" && startParentSlug.trim()
      ? startParentSlug.trim()
      : null;
  let guard = 0;
  const visited = new Set<string>();
  while (currentSlug && guard++ < maxDepth) {
    if (visited.has(currentSlug)) break;
    visited.add(currentSlug);
    const row = await getCmsPageBySlugLocalePublic(supabase, currentSlug, locale);
    if (!row) break;
    const label = row.breadcrumb_label?.trim() || row.title?.trim() || row.slug;
    crumbs.unshift({ label, href: `/p/${row.slug}` });
    const parent = row.parent_slug?.trim();
    currentSlug = parent && parent.length > 0 ? parent : null;
  }
  return crumbs;
}

/**
 * Walks `parent_slug` up to `maxDepth` for storefront breadcrumbs (includes current page last).
 */
export async function getCmsPageBreadcrumbTrail(
  supabase: SupabaseClient,
  slug: string,
  locale: string,
  maxDepth = 8,
): Promise<{ label: string; href: string }[]> {
  const crumbs: { label: string; href: string }[] = [];
  let currentSlug: string | null = slug;
  let guard = 0;
  const visited = new Set<string>();
  while (currentSlug && guard++ < maxDepth) {
    if (visited.has(currentSlug)) break;
    visited.add(currentSlug);
    const row = await getCmsPageBySlugLocalePublic(supabase, currentSlug, locale);
    if (!row) break;
    const label =
      row.breadcrumb_label?.trim() || row.title?.trim() || row.slug;
    crumbs.unshift({ label, href: `/p/${row.slug}` });
    const parent = row.parent_slug?.trim();
    currentSlug = parent && parent.length > 0 ? parent : null;
  }
  return crumbs;
}
