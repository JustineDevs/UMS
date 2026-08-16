import { z } from "zod";

const nullableText = (max: number) => z.string().max(max).nullable().optional();

const cmsComponentInstanceSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(120),
    componentId: z.string().min(1).max(120),
    variantId: z.string().max(120).optional(),
    props: z.record(z.string().max(80), z.unknown()).default({}),
    slots: z.record(z.string().max(80), z.array(cmsComponentInstanceSchema).max(100)).default({}),
    styleOverrides: z.record(z.string().max(80), z.string().max(500)).optional(),
    lockedStructure: z.boolean().optional(),
  }).strict(),
);

const cmsNodeSchema = z.object({
  id: z.string().min(1).max(120),
  componentId: z.string().min(1).max(120),
  parentId: z.string().max(120).nullable(),
  slot: z.string().max(80).nullable(),
  props: z.record(z.string().max(80), z.unknown()).default({}),
  styles: z.record(z.string().max(80), z.string().max(500)).default({}),
  children: z.array(z.string().min(1).max(120)).max(200),
  variantId: z.string().max(120).optional(),
  blockType: z.string().max(80).optional(),
  lockedStructure: z.boolean().optional(),
}).strict();

const cmsMutationSchema = z.object({
  type: z.string().min(1).max(40),
  nodeId: z.string().max(120).optional(),
  parentId: z.string().max(120).nullable().optional(),
  beforeParentId: z.string().max(120).nullable().optional(),
  slot: z.string().max(80).optional(),
  index: z.number().int().min(0).max(1000).optional(),
  key: z.string().max(120).optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  node: z.unknown().optional(),
}).strict();

export const cmsBlockSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.string().min(1).max(80),
  componentId: z.string().max(120).optional(),
  variantId: z.string().max(120).optional(),
  props: z.record(z.string().max(80), z.unknown()).default({}),
  slots: z.record(z.string().max(80), z.array(cmsComponentInstanceSchema).max(100)).optional(),
  styleOverrides: z.record(z.string().max(80), z.string().max(500)).optional(),
}).strict();

export const cmsPageSchema = z.object({
  id: z.string().uuid().optional(),
  expectedVersion: z.number().int().positive().max(100000).optional(),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale: z.string().trim().min(2).max(16).default("en"),
  page_type: z.enum(["static", "landing", "legal"]).optional(),
  title: z.string().max(240).optional(),
  body: z.string().max(500_000).optional(),
  blocks: z.array(cmsBlockSchema).max(200).optional(),
  tree: z.array(cmsNodeSchema).max(1000).optional(),
  mutations: z.array(cmsMutationSchema).max(500).optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  published_at: nullableText(64),
  scheduled_publish_at: nullableText(64),
  preview_token: nullableText(160),
  meta_title: nullableText(240),
  meta_description: nullableText(500),
  canonical_url: nullableText(2048),
  og_image_url: nullableText(2048),
  json_ld: z.unknown().nullable().optional(),
  parent_slug: z.string().trim().max(160).nullable().optional(),
  breadcrumb_label: nullableText(160),
}).strict();

export const cmsExperimentSchema = z.object({
  id: z.string().uuid().optional(),
  experiment_key: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/),
  name: z.string().trim().max(240).optional(),
  variants: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(160),
    weight: z.number().min(0).max(100).optional(),
    componentId: z.string().max(120).optional(),
    props: z.record(z.string().max(80), z.unknown()).optional(),
  }).strict()).min(1).max(20),
  active: z.boolean().optional(),
  starts_at: nullableText(64),
  ends_at: nullableText(64),
  traffic_cap_pct: z.number().min(0).max(100).nullable().optional(),
  target_page_slug: z.string().trim().max(160).nullable().optional(),
  target_component_key: z.string().trim().max(160).nullable().optional(),
  impressions: z.number().int().min(0).optional(),
  conversions: z.number().int().min(0).optional(),
}).strict();

export const cmsMediaMetadataSchema = z.object({
  alt_text: nullableText(500),
  display_name: nullableText(160),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
}).strict();

export const cmsRedirectSchema = z.object({
  id: z.string().uuid().optional(),
  from_path: z.string().trim().min(1).max(2048).regex(/^\//),
  to_path: z.string().trim().min(1).max(2048).regex(/^\//),
  status_code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional(),
  active: z.boolean().optional(),
  preserve_query: z.boolean().optional(),
}).strict();

export const cmsRedirectBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  active: z.boolean(),
}).strict();

export const cmsBlogSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale: z.string().trim().min(2).max(16).default("en"),
  title: z.string().trim().min(1).max(240),
  excerpt: z.string().max(1000).optional(),
  body: z.string().max(500_000).optional(),
  cover_image_url: nullableText(2048),
  author_name: nullableText(160),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  published_at: nullableText(64),
  scheduled_publish_at: nullableText(64),
  preview_token: nullableText(160),
  meta_title: nullableText(240),
  meta_description: nullableText(500),
  canonical_url: nullableText(2048),
  og_image_url: nullableText(2048),
  rss_include: z.boolean().optional(),
  json_ld: z.unknown().nullable().optional(),
}).strict();

export const cmsBlogBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
}).strict();

export const cmsAnnouncementSchema = z.object({
  id: z.string().max(120).optional(),
  body: z.string().max(10_000).optional(),
  bodyFormat: z.enum(["plain", "html"]).optional(),
  linkUrl: nullableText(2048),
  linkLabel: nullableText(160),
  dismissible: z.boolean().optional(),
  startsAt: nullableText(64),
  endsAt: nullableText(64),
  locale: z.string().trim().min(2).max(16).optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  stackGroup: nullableText(120),
  regionCode: nullableText(16),
}).strict();

export const cmsCategoryContentSchema = z.object({
  id: z.string().uuid().optional(),
  collection_handle: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale: z.string().trim().min(2).max(16).default("en"),
  intro_html: z.string().max(100_000).optional(),
  banner_url: nullableText(2048),
  blocks: z.array(cmsBlockSchema).max(100).optional(),
}).strict();

const navLinkSchema: z.ZodType<unknown> = z.lazy(() => z.object({
  href: z.string().trim().min(1).max(2048),
  label: z.string().trim().min(1).max(160),
  badge: z.string().max(80).optional(),
  iconKey: z.string().max(80).optional(),
  startsAt: z.string().max(64).optional(),
  endsAt: z.string().max(64).optional(),
  featured: z.object({ href: z.string().max(2048), label: z.string().max(160), imageUrl: z.string().max(2048).optional() }).strict().optional(),
  children: z.array(navLinkSchema).max(50).optional(),
}).strict());

export const cmsNavigationSchema = z.object({
  mode: z.enum(["draft", "live"]).optional(),
  payload: z.object({
    headerLinks: z.array(navLinkSchema).max(100).optional(),
    headerLinksMobile: z.array(navLinkSchema).max(100).optional(),
    footerColumns: z.array(z.object({ title: z.string().max(160), links: z.array(navLinkSchema).max(100) }).strict()).max(50).optional(),
    footerBottomLinks: z.array(navLinkSchema).max(100).optional(),
    socialLinks: z.array(z.record(z.string().max(80), z.string().max(2048))).max(50).optional(),
  }).strict().optional(),
  headerLinks: z.array(navLinkSchema).max(100).optional(),
  headerLinksMobile: z.array(navLinkSchema).max(100).optional(),
  footerColumns: z.array(z.object({ title: z.string().max(160), links: z.array(navLinkSchema).max(100) }).strict()).max(50).optional(),
  footerBottomLinks: z.array(navLinkSchema).max(100).optional(),
  socialLinks: z.array(z.record(z.string().max(80), z.string().max(2048))).max(50).optional(),
}).strict();

export const cmsPresetSchema = z.object({
  name: z.string().trim().min(1).max(160),
  blocks: z.array(cmsBlockSchema).max(100),
}).strict();

export const cmsFormSettingsSchema = z.object({
  webhook_url: nullableText(2048),
  notify_email: z.string().email().max(320).nullable().optional(),
}).strict();

export const cmsFormSubmissionSchema = z.object({
  read_at: nullableText(64),
  assigned_to: nullableText(160),
  spam_score: z.number().min(0).max(1).optional(),
}).strict();
