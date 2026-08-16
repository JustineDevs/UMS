import type { SupabaseClient } from "@supabase/supabase-js";
import { isCmsPubliclyVisible } from "./cms-public-visibility.js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";
import type {
  CmsBlock,
  CmsComponentInstance,
  CmsPageRow,
  CmsPageType,
  CmsPublishStatus,
  CmsNode,
  CmsMutationRecord,
} from "./cms-types.js";

export type { CmsNode } from "./cms-types.js";

function parseCmsNode(value: unknown, fallbackId: string): CmsNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.trim() ? row.id : fallbackId;
  const componentId = typeof row.componentId === "string" && row.componentId.trim()
    ? row.componentId
    : "unknown-component";
  return {
    id,
    componentId,
    parentId: typeof row.parentId === "string" && row.parentId ? row.parentId : null,
    slot: typeof row.slot === "string" && row.slot ? row.slot : null,
    props: isRecord(row.props) ? row.props : {},
    styles: parseStringRecord(row.styles) ?? {},
    children: Array.isArray(row.children)
      ? row.children.filter((child): child is string => typeof child === "string" && child.length > 0)
      : [],
    variantId: typeof row.variantId === "string" ? row.variantId : undefined,
    blockType: typeof row.blockType === "string" ? row.blockType : undefined,
    lockedStructure: typeof row.lockedStructure === "boolean" ? row.lockedStructure : undefined,
  };
}

/** Repairs persisted links while retaining every identifiable CMS node, including unknown components. */
export function normalizeCmsTree(value: unknown): CmsNode[] {
  if (!Array.isArray(value)) return [];
  const nodes: CmsNode[] = [];
  const byId = new Map<string, CmsNode>();
  value.forEach((item, index) => {
    const node = parseCmsNode(item, `cms_node_${index}`);
    if (!node || byId.has(node.id)) return;
    byId.set(node.id, node);
    nodes.push(node);
  });
  for (const node of nodes) {
    if (node.parentId && !byId.has(node.parentId)) node.parentId = null;
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const breakCycles = (node: CmsNode) => {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) {
      node.parentId = null;
      return;
    }
    visiting.add(node.id);
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (parent) breakCycles(parent);
      if (node.parentId && node.parentId === node.id) node.parentId = null;
    }
    visiting.delete(node.id);
    visited.add(node.id);
  };
  nodes.forEach(breakCycles);
  for (const parent of nodes) {
    const listed = new Set<string>();
    const children = parent.children.filter((id) => {
      const child = byId.get(id);
      if (!child || child.parentId !== parent.id || listed.has(id)) return false;
      listed.add(id);
      return true;
    });
    for (const child of nodes) {
      if (child.parentId === parent.id && !listed.has(child.id)) children.push(child.id);
    }
    parent.children = children;
  }
  return nodes;
}

export function cmsBlocksToTree(blocks: CmsBlock[]): CmsNode[] {
  const nodes: CmsNode[] = [];
  const visit = (
    id: string,
    componentId: string,
    blockType: string,
    props: Record<string, unknown>,
    styles: Record<string, string>,
    variantId: string | undefined,
    parentId: string | null,
    slot: string | null,
    children: CmsComponentInstance[],
  ) => {
    const childIds: string[] = [];
    const node: CmsNode = { id, componentId, blockType, parentId, slot, props, styles, children: childIds, variantId };
    nodes.push(node);
    for (const child of children) {
      childIds.push(child.id);
      const nestedIds: string[] = [];
      const childNode: CmsNode = {
        id: child.id,
        componentId: child.componentId,
        parentId: id,
        slot,
        props: child.props,
        styles: child.styleOverrides ?? {},
        children: nestedIds,
        variantId: child.variantId,
        lockedStructure: child.lockedStructure,
      };
      nodes.push(childNode);
      for (const [childSlot, slotItems] of Object.entries(child.slots ?? {})) {
        for (const nested of slotItems) {
          nestedIds.push(nested.id);
          visitInstance(nested, child.id, childSlot);
        }
      }
    }
  };
  const visitInstance = (instance: CmsComponentInstance, parentId: string, slot: string) => {
    const childIds: string[] = [];
    const node: CmsNode = {
      id: instance.id,
      componentId: instance.componentId,
      parentId,
      slot,
      props: instance.props,
      styles: instance.styleOverrides ?? {},
      children: childIds,
      variantId: instance.variantId,
      lockedStructure: instance.lockedStructure,
    };
    nodes.push(node);
    for (const [childSlot, items] of Object.entries(instance.slots ?? {})) {
      for (const child of items) {
        childIds.push(child.id);
        visitInstance(child, instance.id, childSlot);
      }
    }
  };
  for (const block of blocks) {
    visit(block.id, block.componentId ?? block.type, block.type, block.props, block.styleOverrides ?? {}, block.variantId, null, null, []);
    const root = nodes[nodes.length - 1];
    for (const [slot, items] of Object.entries(block.slots ?? {})) {
      for (const child of items) {
        root.children.push(child.id);
        visitInstance(child, block.id, slot);
      }
    }
  }
  return nodes;
}

export function cmsTreeToBlocks(tree: CmsNode[]): CmsBlock[] {
  const normalized = normalizeCmsTree(tree);
  const byId = new Map(normalized.map((node) => [node.id, node]));
  const buildInstance = (node: CmsNode): CmsComponentInstance => {
    const slots: Record<string, CmsComponentInstance[]> = {};
    for (const childId of node.children) {
      const child = byId.get(childId);
      if (!child || !child.slot) continue;
      (slots[child.slot] ??= []).push(buildInstance(child));
    }
    return { id: node.id, componentId: node.componentId, variantId: node.variantId, props: node.props, slots, styleOverrides: node.styles, lockedStructure: node.lockedStructure };
  };
  return normalized.filter((node) => node.parentId === null).map((node) => ({
    id: node.id,
    type: node.blockType ?? node.componentId.replaceAll("-", "_"),
    componentId: node.componentId,
    variantId: node.variantId,
    props: node.props,
    styleOverrides: node.styles,
    slots: node.children.map((id) => byId.get(id)).filter((child): child is CmsNode => Boolean(child && child.slot)).reduce<Record<string, CmsComponentInstance[]>>((acc, child) => {
      (acc[child.slot!] ??= []).push(buildInstance(child));
      return acc;
    }, {}),
  }));
}

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
  const tree = Array.isArray(r.tree)
    ? normalizeCmsTree(r.tree)
    : cmsBlocksToTree(parseBlocks(r.blocks));
  return {
    id: String(r.id),
    organization_id: r.organization_id != null ? String(r.organization_id) : null,
    slug: String(r.slug ?? ""),
    locale: String(r.locale ?? "en"),
    page_type: (r.page_type as CmsPageType) ?? "static",
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    blocks: tree.length ? cmsTreeToBlocks(tree) : parseBlocks(r.blocks),
    tree,
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
  expectedVersion?: number;
  slug: string;
  locale?: string;
  page_type?: CmsPageType;
  title?: string;
  body?: string;
  blocks?: CmsBlock[];
  tree?: CmsNode[];
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
  mutations?: CmsMutationRecord[];
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
  const nextTree = normalizeCmsTree(
    input.tree ?? (input.blocks ? cmsBlocksToTree(input.blocks) : existing?.tree ?? []),
  );
  const row = {
    organization_id: input.organization_id ?? existing?.organization_id ?? null,
    slug: input.slug,
    locale,
    page_type: input.page_type ?? existing?.page_type ?? "static",
    title: input.title ?? existing?.title ?? "",
    body: input.body ?? existing?.body ?? "",
    blocks: (input.blocks ?? (nextTree.length ? cmsTreeToBlocks(nextTree) : existing?.blocks ?? [])) as unknown as Record<string, unknown>[],
    tree: nextTree as unknown as Record<string, unknown>[],
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
      .eq("version", input.expectedVersion ?? existing.version)
      .select("*")
      .single();
    if (error) {
      console.error("[cms-pages] upsertCmsPage update", error.message);
      return null;
    }
    if (input.mutations?.length) {
      await appendCmsPageMutations(supabase, existing.id, nextVersion, input.organization_id, input.mutations);
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
  if (input.mutations?.length) {
    await appendCmsPageMutations(supabase, data.id as string, nextVersion, input.organization_id, input.mutations);
  }
  return rowToPage(data as Record<string, unknown>);
}

export async function appendCmsPageMutations(
  supabase: SupabaseClient,
  pageId: string,
  revision: number,
  organizationId: string | undefined,
  mutations: CmsMutationRecord[],
) {
  const { error } = await supabase.from("cms_page_mutations").insert(
    mutations.map((mutation, sequence) => ({
      page_id: pageId,
      organization_id: organizationId ?? null,
      revision,
      sequence,
      mutation: mutation as unknown as Record<string, unknown>,
    })),
  );
  if (error && !isMissingTableOrSchemaError(error)) {
    console.error("[cms-pages] appendCmsPageMutations", error.message);
    return false;
  }
  return true;
}

export async function listCmsPageMutations(
  supabase: SupabaseClient,
  pageId: string,
  organizationId?: string,
  limit = 500,
) {
  let query = supabase
    .from("cms_page_mutations")
    .select("id, page_id, organization_id, revision, sequence, mutation, created_at")
    .eq("page_id", pageId)
    .order("revision", { ascending: false })
    .order("sequence", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 1000));
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-pages] listCmsPageMutations", error.message);
    return [];
  }
  return data ?? [];
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
