export type CmsPageType = "static" | "landing" | "legal";
export type CmsPublishStatus = "draft" | "published" | "scheduled";

/** Optional promo tile shown next to a mega-menu column. */
export type CmsNavFeatured = {
  href: string;
  label: string;
  imageUrl?: string;
};

/**
 * Header/footer link. Optional `children` powers desktop mega menus.
 * `startsAt` / `endsAt` are ISO timestamps; omitted links are filtered at read time on the storefront.
 */
export type CmsNavLink = {
  href: string;
  label: string;
  badge?: string;
  iconKey?: string;
  children?: CmsNavLink[];
  featured?: CmsNavFeatured;
  startsAt?: string;
  endsAt?: string;
};

export type CmsFooterColumn = {
  title: string;
  links: CmsNavLink[];
};

export type CmsSocialLink = { href: string; label: string; network?: string };

export type CmsNavigationPayload = {
  headerLinks: CmsNavLink[];
  /** When non-empty, used for the compact / mobile nav instead of top-level header links. */
  headerLinksMobile: CmsNavLink[];
  footerColumns: CmsFooterColumn[];
  /** Thin bar below main footer columns (legal, region, etc.). */
  footerBottomLinks: CmsNavLink[];
  socialLinks: CmsSocialLink[];
};

export type CmsComponentPropType =
  | "text"
  | "rich-text"
  | "url"
  | "image"
  | "file"
  | "gallery"
  | "email"
  | "tel"
  | "date"
  | "datetime"
  | "boolean"
  | "checkbox"
  | "toggle"
  | "number"
  | "range"
  | "color"
  | "select"
  | "radio"
  | "product"
  | "post"
  | "taxonomy"
  | "oembed"
  | "icon"
  | "code"
  | "json";

export type CmsComponentPropOption = { label: string; value: string };

export type CmsComponentPropDefinition = {
  key: string;
  label: string;
  type: CmsComponentPropType;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: CmsComponentPropOption[];
  /** Optional DOM mapping used by the builder inspector. */
  htmlAttr?: string;
  child?: string;
  parent?: string;
  section?: "content" | "style" | "advanced";
  sort?: number;
  inline?: boolean;
  dataSource?: string;
  responsive?: boolean;
};

export type CmsComponentMatch = {
  tags?: string[];
  classes?: string[];
  classesRegex?: string[];
  attributes?: Record<string, string | string[]>;
  selector?: string;
};

export type CmsComponentSlotDefinition = {
  name: string;
  label: string;
  description?: string;
  allowedComponentIds?: string[];
  multiple?: boolean;
};

export type CmsComponentVariant = {
  id: string;
  label: string;
  description?: string;
  props?: Record<string, unknown>;
  styleTokens?: Record<string, string>;
};

/** A reusable main component definition shared by every component instance. */
export type CmsComponentDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  version: number;
  structure: string;
  /** Optional isolated-canvas source for reusable visual authoring. */
  markup?: string;
  styles?: string;
  styleTokens: Record<string, string>;
  props: CmsComponentPropDefinition[];
  slots: CmsComponentSlotDefinition[];
  variants: CmsComponentVariant[];
  /** Optional reusable parent definition. Child fields override parent fields. */
  extendsComponentId?: string;
  defaultVariantId?: string;
  isGlobal?: boolean;
  match?: CmsComponentMatch;
  resizable?: boolean;
  responsive?: boolean;
  toolbar?: string[];
};

/** A nested component placed in a slot or directly on a page. */
export type CmsComponentInstance = {
  id: string;
  componentId: string;
  variantId?: string;
  props: Record<string, unknown>;
  slots: Record<string, CmsComponentInstance[]>;
  styleOverrides?: Record<string, string>;
  lockedStructure?: boolean;
};

export type CmsBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  /** Optional reusable component definition. Omitted for legacy blocks. */
  componentId?: string;
  variantId?: string;
  slots?: Record<string, CmsComponentInstance[]>;
  styleOverrides?: Record<string, string>;
};

export type CmsNode = {
  id: string;
  componentId: string;
  parentId: string | null;
  slot: string | null;
  props: Record<string, unknown>;
  styles: Record<string, string>;
  children: string[];
  variantId?: string;
  blockType?: string;
  lockedStructure?: boolean;
};

export type CmsMutationRecord = {
  type: string;
  nodeId?: string;
  parentId?: string | null;
  beforeParentId?: string | null;
  slot?: string;
  index?: number;
  key?: string;
  before?: unknown;
  after?: unknown;
  node?: unknown;
};

export type CmsPageRow = {
  id: string;
  organization_id: string | null;
  slug: string;
  locale: string;
  page_type: CmsPageType;
  title: string;
  body: string;
  blocks: CmsBlock[];
  tree: CmsNode[];
  mutations?: CmsMutationRecord[];
  status: CmsPublishStatus;
  published_at: string | null;
  scheduled_publish_at: string | null;
  preview_token: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
  json_ld: unknown | null;
  version: number;
  created_at: string;
  updated_at: string;
  /** Optional parent CMS page slug for breadcrumbs. */
  parent_slug: string | null;
  /** Optional shorter crumb label (defaults to title). */
  breadcrumb_label: string | null;
};

export type CmsPageBlockPresetRow = {
  id: string;
  name: string;
  blocks: CmsBlock[];
  created_at: string;
};

export type CmsBlogPostRow = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  author_name: string | null;
  tags: string[];
  status: CmsPublishStatus;
  published_at: string | null;
  scheduled_publish_at: string | null;
  preview_token: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
  rss_include: boolean;
  json_ld: unknown | null;
  created_at: string;
  updated_at: string;
};

export type CmsPaymentLinkRow = {
  id: string;
  title: string;
  provider: string;
  payment_url: string;
  description: string;
  locale: string;
  cta_label: string;
  active: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
