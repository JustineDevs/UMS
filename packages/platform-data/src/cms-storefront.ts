import { createClient } from "@supabase/supabase-js";
import { getCmsNavigationPayload } from "./cms-navigation.js";
import { listCmsAnnouncementsForLocalePublic } from "./cms-announcement.js";
import {
  getCmsPageBySlugLocalePublic,
  getCmsPageBySlugPreview,
  listCmsPagesForSitemapPublic,
} from "./cms-pages.js";
import {
  getCmsBlogPostBySlugPublic,
  listCmsBlogPostsPublic,
  listCmsBlogPostsForSitemapPublic,
} from "./cms-blog.js";
import { getCmsCategoryContentPublic, listCmsCategoryContent } from "./cms-category.js";
import { listCmsAbExperiments } from "./cms-experiments.js";
import { parseCmsCategoryBlocks } from "./cms-category.js";
import type {
  CmsPageRow,
  CmsBlogPostRow,
  CmsNavigationPayload,
} from "./cms-types.js";
import type { CmsAnnouncementRow } from "./cms-announcement.js";
import type { CmsCategoryContentRow } from "./cms-category.js";
import type { CmsAbExperimentRow } from "./cms-experiments.js";

function workerBaseUrl(): string | null {
  const value = process.env.API_URL?.trim().replace(/\/$/, "");
  return value || null;
}

async function workerGet<T>(path: string): Promise<T | null> {
  const base = workerBaseUrl();
  if (!base) return null;
  try {
    const response = await fetch(`${base}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function workerLink(value: unknown): CmsNavigationPayload["headerLinks"][number] | null {
  if (!record(value) || typeof value.href !== "string" || typeof value.label !== "string") return null;
  return {
    href: value.href,
    label: value.label,
    ...(typeof value.badge === "string" ? { badge: value.badge } : {}),
    ...(typeof value.iconKey === "string" ? { iconKey: value.iconKey } : {}),
    ...(typeof value.startsAt === "string" ? { startsAt: value.startsAt } : {}),
    ...(typeof value.endsAt === "string" ? { endsAt: value.endsAt } : {}),
    ...(Array.isArray(value.children)
      ? { children: value.children.map(workerLink).filter((item): item is NonNullable<ReturnType<typeof workerLink>> => item !== null) }
      : {}),
    ...(record(value.featured) && typeof value.featured.href === "string" && typeof value.featured.label === "string"
      ? { featured: { href: value.featured.href, label: value.featured.label, ...(typeof value.featured.imageUrl === "string" ? { imageUrl: value.featured.imageUrl } : {}) } }
      : {}),
  };
}

function workerLinks(value: unknown) {
  return Array.isArray(value)
    ? value.map(workerLink).filter((item): item is NonNullable<ReturnType<typeof workerLink>> => item !== null)
    : [];
}

function workerNavigation(value: unknown): CmsNavigationPayload | null {
  if (!record(value)) return null;
  return {
    headerLinks: workerLinks(value.headerLinks),
    headerLinksMobile: workerLinks(value.headerLinksMobile),
    footerColumns: Array.isArray(value.footerColumns)
      ? value.footerColumns.filter(record).map((column) => ({
          title: typeof column.title === "string" ? column.title : "",
          links: workerLinks(column.links),
        }))
      : [],
    footerBottomLinks: workerLinks(value.footerBottomLinks),
    socialLinks: Array.isArray(value.socialLinks)
      ? value.socialLinks.filter(record).flatMap((link) =>
          typeof link.href === "string" && typeof link.label === "string"
            ? [{ href: link.href, label: link.label, ...(typeof link.network === "string" ? { network: link.network } : {}) }]
            : [],
        )
      : [],
  };
}

function emptyNavigation(): CmsNavigationPayload {
  return {
    headerLinks: [],
    headerLinksMobile: [],
    footerColumns: [],
    footerBottomLinks: [],
    socialLinks: [],
  };
}

function workerPage(value: unknown): CmsPageRow | null {
  if (!record(value) || typeof value.id !== "string" || typeof value.slug !== "string") return null;
  return {
    id: value.id,
    organization_id: typeof value.organization_id === "string" ? value.organization_id : null,
    slug: value.slug,
    locale: typeof value.locale === "string" ? value.locale : "en",
    page_type: value.page_type === "landing" || value.page_type === "legal" ? value.page_type : "static",
    title: typeof value.title === "string" ? value.title : "",
    body: typeof value.body === "string" ? value.body : "",
    blocks: Array.isArray(value.blocks) ? value.blocks as CmsPageRow["blocks"] : [],
    tree: Array.isArray(value.tree) ? value.tree as CmsPageRow["tree"] : [],
    mutations: Array.isArray(value.mutations) ? value.mutations as CmsPageRow["mutations"] : [],
    status: value.status === "scheduled" || value.status === "published" ? value.status : "draft",
    published_at: typeof value.published_at === "string" ? value.published_at : null,
    scheduled_publish_at: typeof value.scheduled_publish_at === "string" ? value.scheduled_publish_at : null,
    preview_token: null,
    meta_title: typeof value.meta_title === "string" ? value.meta_title : null,
    meta_description: typeof value.meta_description === "string" ? value.meta_description : null,
    canonical_url: typeof value.canonical_url === "string" ? value.canonical_url : null,
    og_image_url: typeof value.og_image_url === "string" ? value.og_image_url : null,
    json_ld: value.json_ld ?? null,
    version: Number.isFinite(Number(value.version)) ? Number(value.version) : 1,
    created_at: typeof value.created_at === "string" ? value.created_at : "",
    updated_at: typeof value.updated_at === "string" ? value.updated_at : "",
    parent_slug: typeof value.parent_slug === "string" ? value.parent_slug : null,
    breadcrumb_label: typeof value.breadcrumb_label === "string" ? value.breadcrumb_label : null,
  };
}

function workerAnnouncement(value: unknown): CmsAnnouncementRow | null {
  if (!record(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    body: typeof value.body === "string" ? value.body : "",
    bodyFormat: value.body_format === "html" ? "html" : "plain",
    linkUrl: typeof value.link_url === "string" ? value.link_url : null,
    linkLabel: typeof value.link_label === "string" ? value.link_label : null,
    dismissible: value.dismissible === true,
    startsAt: typeof value.starts_at === "string" ? value.starts_at : null,
    endsAt: typeof value.ends_at === "string" ? value.ends_at : null,
    locale: typeof value.locale === "string" ? value.locale : "en",
    priority: Number.isFinite(Number(value.priority)) ? Number(value.priority) : 0,
    stackGroup: typeof value.stack_group === "string" ? value.stack_group : null,
    regionCode: typeof value.region_code === "string" ? value.region_code : null,
  };
}

function workerCategory(value: unknown): CmsCategoryContentRow | null {
  if (!record(value) || typeof value.id !== "string" || typeof value.collection_handle !== "string") return null;
  return {
    id: value.id,
    collection_id: typeof value.collection_id === "string" ? value.collection_id : null,
    collection_handle: value.collection_handle,
    locale: typeof value.locale === "string" ? value.locale : "en",
    intro_html: typeof value.intro_html === "string" ? value.intro_html : "",
    banner_url: typeof value.banner_url === "string" ? value.banner_url : null,
    banner_alt: typeof value.banner_alt === "string" ? value.banner_alt : null,
    blocks: parseCmsCategoryBlocks(value.blocks),
    updated_at: typeof value.updated_at === "string" ? value.updated_at : "",
    organization_id: typeof value.organization_id === "string" ? value.organization_id : null,
  };
}

function workerBlog(value: unknown): CmsBlogPostRow | null {
  if (!record(value) || typeof value.id !== "string" || typeof value.slug !== "string") return null;
  return {
    id: value.id,
    slug: value.slug,
    locale: typeof value.locale === "string" ? value.locale : "en",
    title: typeof value.title === "string" ? value.title : "",
    excerpt: typeof value.excerpt === "string" ? value.excerpt : "",
    body: typeof value.body === "string" ? value.body : "",
    cover_image_url: typeof value.cover_image_url === "string" ? value.cover_image_url : null,
    author_name: typeof value.author_name === "string" ? value.author_name : null,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [],
    status: value.status === "scheduled" || value.status === "published" ? value.status : "draft",
    published_at: typeof value.published_at === "string" ? value.published_at : null,
    scheduled_publish_at: typeof value.scheduled_publish_at === "string" ? value.scheduled_publish_at : null,
    preview_token: null,
    meta_title: typeof value.meta_title === "string" ? value.meta_title : null,
    meta_description: typeof value.meta_description === "string" ? value.meta_description : null,
    canonical_url: null,
    og_image_url: typeof value.og_image_url === "string" ? value.og_image_url : null,
    rss_include: true,
    json_ld: value.json_ld ?? null,
    created_at: typeof value.created_at === "string" ? value.created_at : "",
    updated_at: typeof value.updated_at === "string" ? value.updated_at : "",
  };
}

function anonClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

function publicOrganizationId(): string | null {
  const id = process.env.DEFAULT_ORGANIZATION_ID?.trim();
  return id || null;
}

export async function loadCmsPagePublic(slug: string, locale = "en"): Promise<CmsPageRow | null> {
  const worker = await workerGet<{ page?: unknown }>(`/store/pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`);
  if (workerBaseUrl()) return workerPage(worker?.page);
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return null;
  return getCmsPageBySlugLocalePublic(sb, slug, locale, organizationId);
}

export async function loadCmsPagePreviewPublic(
  slug: string,
  previewToken: string,
  locale = "en",
): Promise<CmsPageRow | null> {
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return null;
  const token = previewToken.trim();
  if (!token) return null;
  return getCmsPageBySlugPreview(sb, slug, locale, token, organizationId);
}

export async function loadCmsNavigationPublic(): Promise<CmsNavigationPayload> {
  const worker = await workerGet<{ navigation?: unknown }>("/store/navigation");
  if (workerBaseUrl()) return workerNavigation(worker?.navigation) ?? emptyNavigation();
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId)
    return {
      headerLinks: [],
      headerLinksMobile: [],
      footerColumns: [],
      footerBottomLinks: [],
      socialLinks: [],
    };
  return getCmsNavigationPayload(sb, organizationId);
}

const DEFAULT_CMS_LOCALE = (process.env.NEXT_PUBLIC_CMS_LOCALE ?? "en").trim() || "en";

/** Active announcement bars for a locale (stacking rules applied). */
export async function loadCmsAnnouncementsPublic(locale = DEFAULT_CMS_LOCALE): Promise<CmsAnnouncementRow[]> {
  const worker = await workerGet<{ announcements?: unknown[] }>(`/store/announcements?locale=${encodeURIComponent(locale)}`);
  if (workerBaseUrl()) return (worker?.announcements ?? []).map(workerAnnouncement).filter((item): item is CmsAnnouncementRow => item !== null);
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return [];
  return listCmsAnnouncementsForLocalePublic(sb, locale, undefined, organizationId);
}

/** @deprecated Prefer loadCmsAnnouncementsPublic (returns stacked list). */
export async function loadCmsAnnouncementPublic(): Promise<CmsAnnouncementRow | null> {
  const rows = await loadCmsAnnouncementsPublic(DEFAULT_CMS_LOCALE);
  return rows[0] ?? null;
}

export async function loadCmsCategoryContentPublic(
  collectionHandle: string,
  locale = "en",
  collectionId?: string,
): Promise<CmsCategoryContentRow | null> {
  const worker = await workerGet<{ content?: unknown }>(`/store/categories/${encodeURIComponent(collectionHandle)}?locale=${encodeURIComponent(locale)}`);
  if (workerBaseUrl()) return workerCategory(worker?.content);
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return null;
  return getCmsCategoryContentPublic(sb, collectionHandle, locale, organizationId, collectionId);
}

export async function loadCmsCategoryContentListPublic(
  locale = DEFAULT_CMS_LOCALE,
): Promise<CmsCategoryContentRow[]> {
  const worker = await workerGet<{ contents?: unknown[] }>(`/store/categories?locale=${encodeURIComponent(locale)}`);
  if (workerBaseUrl()) return (worker?.contents ?? []).map(workerCategory).filter((item): item is CmsCategoryContentRow => item !== null);
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return [];
  return (await listCmsCategoryContent(sb, organizationId)).filter(
    (row) => row.locale === locale,
  );
}

export async function loadCmsBlogListPublic(locale = "en"): Promise<CmsBlogPostRow[]> {
  const worker = await workerGet<{ posts?: unknown[] }>(`/store/blog?locale=${encodeURIComponent(locale)}`);
  if (workerBaseUrl()) return (worker?.posts ?? []).map(workerBlog).filter((item): item is CmsBlogPostRow => item !== null);
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return [];
  return listCmsBlogPostsPublic(sb, locale, 40, organizationId);
}

export async function loadCmsBlogPostPublic(slug: string, locale = "en"): Promise<CmsBlogPostRow | null> {
  const worker = await workerGet<{ post?: unknown }>(`/store/blog/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`);
  if (workerBaseUrl()) return workerBlog(worker?.post);
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return null;
  return getCmsBlogPostBySlugPublic(sb, slug, locale, organizationId);
}

export async function loadCmsAbExperimentsActivePublic(): Promise<CmsAbExperimentRow[]> {
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return [];
  const rows = await listCmsAbExperiments(sb, organizationId);
  const now = Date.now();
  return rows.filter((r) => {
    if (!r.active) return false;
    if (r.starts_at && new Date(r.starts_at).getTime() > now) return false;
    if (r.ends_at && new Date(r.ends_at).getTime() < now) return false;
    return true;
  });
}

export async function loadCmsSitemapEntries(): Promise<{
  pages: { slug: string; locale: string; updated_at: string }[];
  posts: { slug: string; locale: string; updated_at: string }[];
}> {
  const worker = await workerGet<{ entries?: unknown[] }>("/store/sitemap");
  if (workerBaseUrl()) {
    const pages: { slug: string; locale: string; updated_at: string }[] = [];
    const posts: { slug: string; locale: string; updated_at: string }[] = [];
    for (const entry of worker?.entries ?? []) {
      if (!record(entry) || typeof entry.slug !== "string" || typeof entry.locale !== "string") continue;
      const item = { slug: entry.slug, locale: entry.locale, updated_at: typeof entry.updated_at === "string" ? entry.updated_at : "" };
      if (entry.kind === "post") posts.push(item);
      else pages.push(item);
    }
    return { pages, posts };
  }
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return { pages: [], posts: [] };
  const [pages, posts] = await Promise.all([
    listCmsPagesForSitemapPublic(sb, organizationId),
    listCmsBlogPostsForSitemapPublic(sb, organizationId),
  ]);
  return { pages, posts };
}
