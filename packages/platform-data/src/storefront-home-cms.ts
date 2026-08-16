import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";
import { cmsTreeToBlocks, getCmsPageBySlugLocalePublic } from "./cms-pages.js";
import type { CmsNode } from "./cms-types.js";

/** One home-page tile for an instrument-led storefront. */
export type StorefrontHomeTile = {
  href: string;
  title: string;
  linkLabel: string;
  /** Shown on the wide tile only (e.g. featured accessories & gear). */
  subtitle?: string;
  /** Optional image URL (https). Empty = solid background. */
  imageUrl: string;
  /** Maps to layout + text treatment in the storefront. */
  variant: "large" | "small" | "wide";
};

export type StorefrontHomeSectionLayout = {
  maxWidth?: string;
  minHeight?: string;
  paddingBlock?: string;
  paddingInline?: string;
};

export type StorefrontHomePayload = {
  domOverrides?: Record<string, Record<string, string>>;
  sectionLayout?: {
    hero?: StorefrontHomeSectionLayout;
    tiles?: StorefrontHomeSectionLayout;
    latest?: StorefrontHomeSectionLayout;
    newsletter?: StorefrontHomeSectionLayout;
  };
  hero: {
    line1: string;
    line2: string;
    lead: string;
    showPrivacyLink: boolean;
    ctaLabel: string;
    ctaHref: string;
    imageUrl: string;
    mediaType: "image" | "video";
    videoUrl: string;
    layout?: StorefrontHomeSectionLayout;
    style: {
      headlineFont: "headline" | "body" | "mono";
      textTone: "brand" | "neutral" | "muted";
      headlineSize: "compact" | "default" | "hero";
      contentWidth: "standard" | "wide" | "extra";
    };
  };
  tiles: StorefrontHomeTile[];
  latestSection: {
    title: string;
    viewAllLabel: string;
    viewAllHref: string;
  };
  newsletter: {
    title: string;
    body: string;
    placeholder: string;
    buttonLabel: string;
  };
};

export const DEFAULT_STOREFRONT_HOME_PAYLOAD: StorefrontHomePayload = {
  hero: {
    line1: "UNIVERSAL",
    line2: "MUSIC STORE",
    lead:
      "Universal Music Store is an online store for guitars, bass, drums, pianos, and accessories & gear. Browse, order, and track shipments.",
    showPrivacyLink: true,
    ctaLabel: "Shop Now",
    ctaHref: "/shop",
    imageUrl: "",
    mediaType: "image",
    videoUrl: "",
    style: {
      headlineFont: "headline",
      textTone: "brand",
      headlineSize: "hero",
      contentWidth: "wide",
    },
  },
  tiles: [
    {
      href: "/shop?category=Guitars",
      title: "Guitars",
      subtitle: "Electric, acoustic, and bass models",
      linkLabel: "Explore collection",
      imageUrl: "",
      variant: "large",
    },
    {
      href: "/shop?category=Drums",
      title: "Drums",
      subtitle: "Kits, cymbals, and percussion",
      linkLabel: "Shop drums",
      imageUrl: "",
      variant: "small",
    },
    {
      href: "/shop?category=Accessories%20%26%20Gear",
      title: "Accessories & Gear",
      subtitle: "Cables, pedals, and studio essentials",
      linkLabel: "",
      imageUrl: "",
      variant: "wide",
    },
  ],
  latestSection: {
    title: "THE LATEST DROPS",
    viewAllLabel: "View All Products",
    viewAllHref: "/shop",
  },
  newsletter: {
    title: "STAY IN TUNE",
    body: "New drops, restocks, and studio notes from Universal Music Store.",
    placeholder: "email@address.com",
    buttonLabel: "Subscribe",
  },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function pickString(r: Record<string, unknown>, key: string, fallback: string): string {
  const v = r[key];
  return typeof v === "string" ? v : fallback;
}

function sanitizeHomeImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "medusa-public-images.s3.eu-west-1.amazonaws.com") return "";
    if (hostname.endsWith("fbcdn.net")) return "";
    return trimmed;
  } catch {
    return trimmed;
  }
}

function pickBool(r: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = r[key];
  return typeof v === "boolean" ? v : fallback;
}

function pickEnum<T extends string>(
  r: Record<string, unknown>,
  key: string,
  fallback: T,
  values: readonly T[],
): T {
  const v = r[key];
  return typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : fallback;
}

function mergeLayout(partial: unknown): StorefrontHomeSectionLayout | undefined {
  if (!isRecord(partial)) return undefined;
  const clean = (value: unknown) => {
    if (typeof value !== "string" || value.length > 40) return undefined;
    return /^[0-9a-zA-Z.%(),\-\s]+$/.test(value.trim()) ? value.trim() : undefined;
  };
  const layout = {
    maxWidth: clean(partial.maxWidth),
    minHeight: clean(partial.minHeight),
    paddingBlock: clean(partial.paddingBlock),
    paddingInline: clean(partial.paddingInline),
  };
  return Object.values(layout).some(Boolean) ? layout : undefined;
}

function mergeHero(partial: unknown): StorefrontHomePayload["hero"] {
  const d = DEFAULT_STOREFRONT_HOME_PAYLOAD.hero;
  if (!isRecord(partial)) return { ...d };
  const style = isRecord(partial.style) ? partial.style : {};
  return {
    line1: pickString(partial, "line1", d.line1),
    line2: pickString(partial, "line2", d.line2),
    lead: pickString(partial, "lead", d.lead),
    showPrivacyLink: pickBool(partial, "showPrivacyLink", d.showPrivacyLink),
    ctaLabel: pickString(partial, "ctaLabel", d.ctaLabel),
    ctaHref: pickString(partial, "ctaHref", d.ctaHref),
    imageUrl: sanitizeHomeImageUrl(pickString(partial, "imageUrl", d.imageUrl)),
    mediaType: pickEnum(partial, "mediaType", d.mediaType, ["image", "video"]),
    videoUrl: sanitizeHomeImageUrl(pickString(partial, "videoUrl", d.videoUrl)),
    layout: mergeLayout(partial.layout),
    style: {
      headlineFont: pickEnum(
        style,
        "headlineFont",
        d.style.headlineFont,
        ["headline", "body", "mono"],
      ),
      textTone: pickEnum(style, "textTone", d.style.textTone, ["brand", "neutral", "muted"]),
      headlineSize: pickEnum(
        style,
        "headlineSize",
        d.style.headlineSize,
        ["compact", "default", "hero"],
      ),
      contentWidth: pickEnum(
        style,
        "contentWidth",
        d.style.contentWidth,
        ["standard", "wide", "extra"],
      ),
    },
  };
}

function mergeTile(
  partial: unknown,
  fallback: StorefrontHomeTile,
): StorefrontHomeTile {
  if (!isRecord(partial)) return { ...fallback };
  const variantRaw = partial.variant;
  const variant: StorefrontHomeTile["variant"] =
    variantRaw === "large" || variantRaw === "small" || variantRaw === "wide"
      ? variantRaw
      : fallback.variant;
  const subtitle = partial.subtitle;
  return {
    href: pickString(partial, "href", fallback.href),
    title: pickString(partial, "title", fallback.title),
    linkLabel: pickString(partial, "linkLabel", fallback.linkLabel),
    subtitle: typeof subtitle === "string" ? subtitle : fallback.subtitle,
    imageUrl: sanitizeHomeImageUrl(pickString(partial, "imageUrl", fallback.imageUrl)),
    variant,
  };
}

function mergeTiles(raw: unknown): StorefrontHomePayload["tiles"] {
  const d = DEFAULT_STOREFRONT_HOME_PAYLOAD.tiles;
  if (!Array.isArray(raw)) return d;
  return raw.length
    ? raw.map((item, index) => mergeTile(item, d[index] ?? d[index % d.length]))
    : d;
}

function mergeLatest(partial: unknown): StorefrontHomePayload["latestSection"] {
  const d = DEFAULT_STOREFRONT_HOME_PAYLOAD.latestSection;
  if (!isRecord(partial)) return { ...d };
  return {
    title: pickString(partial, "title", d.title),
    viewAllLabel: pickString(partial, "viewAllLabel", d.viewAllLabel),
    viewAllHref: pickString(partial, "viewAllHref", d.viewAllHref),
  };
}

function mergeNewsletter(partial: unknown): StorefrontHomePayload["newsletter"] {
  const d = DEFAULT_STOREFRONT_HOME_PAYLOAD.newsletter;
  if (!isRecord(partial)) return { ...d };
  return {
    title: pickString(partial, "title", d.title),
    body: pickString(partial, "body", d.body),
    placeholder: pickString(partial, "placeholder", d.placeholder),
    buttonLabel: pickString(partial, "buttonLabel", d.buttonLabel),
  };
}

function cloneDefaultPayload(): StorefrontHomePayload {
  return JSON.parse(JSON.stringify(DEFAULT_STOREFRONT_HOME_PAYLOAD)) as StorefrontHomePayload;
}

/** Merges stored JSON with defaults so missing keys still render. */
export function mergeStorefrontHomePayload(raw: unknown): StorefrontHomePayload {
  if (!isRecord(raw)) {
    return cloneDefaultPayload();
  }
  return {
    domOverrides: isRecord(raw.domOverrides)
      ? Object.fromEntries(Object.entries(raw.domOverrides).filter(([, value]) => isRecord(value)).map(([id, value]) => [id, value as Record<string, string>]))
      : undefined,
    sectionLayout: isRecord(raw.sectionLayout)
      ? {
          hero: mergeLayout(raw.sectionLayout.hero),
          tiles: mergeLayout(raw.sectionLayout.tiles),
          latest: mergeLayout(raw.sectionLayout.latest),
          newsletter: mergeLayout(raw.sectionLayout.newsletter),
        }
      : undefined,
    hero: mergeHero(raw.hero),
    tiles: mergeTiles(raw.tiles),
    latestSection: mergeLatest(raw.latestSection),
    newsletter: mergeNewsletter(raw.newsletter),
  };
}

const ROW_ID = "default";

export async function getStorefrontHomeContent(
  supabase: SupabaseClient,
): Promise<StorefrontHomePayload> {
  const { data, error } = await supabase
    .from("storefront_home_content")
    .select("payload")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) {
    if (!isMissingTableOrSchemaError(error)) {
      console.error("[storefront-home-cms] getStorefrontHomeContent", error.message);
    }
    return mergeStorefrontHomePayload(null);
  }

  const payload = (data as { payload?: unknown } | null)?.payload;
  return mergeStorefrontHomePayload(payload ?? {});
}

export async function upsertStorefrontHomeContent(
  supabase: SupabaseClient,
  payload: StorefrontHomePayload,
): Promise<void> {
  const merged = mergeStorefrontHomePayload(payload);
  const { error } = await supabase.from("storefront_home_content").upsert(
    {
      id: ROW_ID,
      payload: merged as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Loads home CMS for the public storefront using the anon key (RLS allows SELECT).
 * Returns built-in defaults when Supabase is not configured or the query fails.
 */
export async function loadStorefrontHomeContentForPublic(): Promise<StorefrontHomePayload> {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return mergeStorefrontHomePayload(null);
  }
  try {
    const sb = createClient(url, anonKey);
    const organizationId = process.env.DEFAULT_ORGANIZATION_ID?.trim() || undefined;
    const canonical = await getCmsPageBySlugLocalePublic(sb, "home", "en", organizationId);
    if (canonical?.tree.length) return mergeCanonicalHomeTree(canonical.tree);
    return await getStorefrontHomeContent(sb);
  } catch (e) {
    console.warn("[storefront-home-cms] loadStorefrontHomeContentForPublic", e);
    return mergeStorefrontHomePayload(null);
  }
}

/** The published page tree is authoritative; legacy home content is only a migration fallback. */
function mergeCanonicalHomeTree(tree: CmsNode[]): StorefrontHomePayload {
  const blocks = cmsTreeToBlocks(tree);
  const raw: Record<string, unknown> = {};
  const hero = blocks.find((block) => block.id === "home-hero")?.props;
  if (hero) {
    const lines = String(hero.title ?? "").split(/\r?\n/);
    raw.hero = {
      line1: lines[0] ?? "",
      line2: lines.slice(1).join(" "),
      lead: String(hero.subtitle ?? ""),
      imageUrl: String(hero.imageUrl ?? ""),
      mediaType: hero.mediaType,
      videoUrl: String(hero.videoUrl ?? ""),
      ctaHref: String(hero.href ?? "/shop"),
      ctaLabel: String(hero.ctaLabel ?? "Shop Now"),
      showPrivacyLink: Boolean(hero.showPrivacyLink),
      layout: hero.layout,
      style: hero.style,
    };
    raw.domOverrides = hero.domOverrides;
  }
  const tiles = blocks.find((block) => block.id === "home-tiles")?.props;
  if (tiles) {
    raw.tiles = tiles.tiles;
    raw.sectionLayout = { tiles: tiles.layout };
  }
  const latest = blocks.find((block) => block.id === "home-latest")?.props;
  if (latest) {
    raw.latestSection = {
      title: latest.title,
      viewAllLabel: latest.viewAllLabel,
      viewAllHref: latest.viewAllHref,
    };
    raw.sectionLayout = {
      ...(raw.sectionLayout as Record<string, unknown> | undefined),
      latest: latest.layout,
    };
  }
  const newsletter = blocks.find((block) => block.id === "home-newsletter")?.props;
  if (newsletter) {
    raw.newsletter = {
      title: newsletter.heading,
      body: newsletter.subtitle,
      placeholder: newsletter.placeholder,
      buttonLabel: newsletter.buttonLabel,
    };
    raw.sectionLayout = {
      ...(raw.sectionLayout as Record<string, unknown> | undefined),
      newsletter: newsletter.layout,
    };
  }
  return mergeStorefrontHomePayload(raw);
}
