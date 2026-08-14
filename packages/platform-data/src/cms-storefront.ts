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
import { getCmsCategoryContentPublic } from "./cms-category.js";
import { listCmsAbExperiments } from "./cms-experiments.js";
import type {
  CmsPageRow,
  CmsBlogPostRow,
  CmsNavigationPayload,
} from "./cms-types.js";
import type { CmsAnnouncementRow } from "./cms-announcement.js";
import type { CmsCategoryContentRow } from "./cms-category.js";
import type { CmsAbExperimentRow } from "./cms-experiments.js";

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
): Promise<CmsCategoryContentRow | null> {
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return null;
  return getCmsCategoryContentPublic(sb, collectionHandle, locale, organizationId);
}

export async function loadCmsBlogListPublic(locale = "en"): Promise<CmsBlogPostRow[]> {
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return [];
  return listCmsBlogPostsPublic(sb, locale, 40, organizationId);
}

export async function loadCmsBlogPostPublic(slug: string, locale = "en"): Promise<CmsBlogPostRow | null> {
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
  const sb = anonClient();
  const organizationId = publicOrganizationId();
  if (!sb || !organizationId) return { pages: [], posts: [] };
  const [pages, posts] = await Promise.all([
    listCmsPagesForSitemapPublic(sb, organizationId),
    listCmsBlogPostsForSitemapPublic(sb, organizationId),
  ]);
  return { pages, posts };
}
