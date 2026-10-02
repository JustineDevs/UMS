import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";
import { cmsTreeToBlocks, getCmsPageBySlugLocalePublic } from "./cms-pages.js";
import type { CmsBlock, CmsNode } from "./cms-types.js";

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
  visualBlocks?: CmsBlock[];
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
    line1: "The guitar you’ll keep reaching for.",
    line2: "",
    lead:
      "Electric, acoustic, and bass guitars, plus amps, pedals, strings, and the essentials to build your sound.",
    showPrivacyLink: false,
    ctaLabel: "Explore guitars",
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
      href: "/collections/guitars",
      title: "Guitars",
      subtitle: "Electric, acoustic, and bass models",
      linkLabel: "Explore collection",
      imageUrl: "",
      variant: "large",
    },
    {
      href: "/collections/drums",
      title: "Drums",
      subtitle: "Kits, cymbals, and percussion",
      linkLabel: "Shop drums",
      imageUrl: "",
      variant: "small",
    },
    {
      href: "/collections/accessories-%26-gear",
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

function isHostOrSubdomain(hostname: string, domain: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === domain || normalized.split(".").slice(-2).join(".") === domain;
}

function sanitizeHomeImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "medusa-public-images.s3.eu-west-1.amazonaws.com") return "";
    if (isHostOrSubdomain(hostname, "fbcdn.net")) return "";
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
  const storedLine1 = pickString(partial, "line1", d.line1);
  const storedLine2 = pickString(partial, "line2", d.line2);
  const isLegacyBrandTitle =
    [
      "UNIVERSAL",
      "GEAR FOR EVERY SOUND.",
      "YOUR NEXT GUITAR STARTS HERE.",
      "YOUR SOUND HAS A SHAPE.",
    ].includes(storedLine1.trim().toUpperCase()) ||
    storedLine2.trim().toUpperCase() === "MUSIC STORE";
  return {
    line1: isLegacyBrandTitle ? d.line1 : storedLine1,
    line2: isLegacyBrandTitle ? d.line2 : storedLine2,
    lead: (isLegacyBrandTitle ? d.lead : pickString(partial, "lead", d.lead))
      .replace(/Universal Music Store is an online store for guitars, bass, drums, pianos, and accessories & gear\. Browse, order, and track shipments\.?/i, d.lead)
      .replace(/Premium guitars, amplifiers, and accessories curated for musicians\. Shipped safely nationwide\.?/i, d.lead)
      .replace(/Discover guitars for every kind of player, then add the amps and essentials that bring your sound to life\. Shipped safely across the Philippines\.?/i, d.lead)
      .replace(/\bplanos\b/gi, "pianos"),
    showPrivacyLink: pickBool(partial, "showPrivacyLink", d.showPrivacyLink),
    ctaLabel: isLegacyBrandTitle ? d.ctaLabel : pickString(partial, "ctaLabel", d.ctaLabel),
    ctaHref: isLegacyBrandTitle ? d.ctaHref : pickString(partial, "ctaHref", d.ctaHref),
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
  const domOverrides = isRecord(raw.domOverrides)
    ? Object.fromEntries(
        Object.entries(raw.domOverrides)
          .filter(([, value]) => isRecord(value))
          .map(([id, value]) => {
            if (id !== "home-hero-title" && id !== "home-hero-lead") {
              return [id, value as Record<string, string>];
            }
            const cleaned = { ...(value as Record<string, string>) };
            const textContent = cleaned.textContent?.trim();
            if (id === "home-hero-title") {
              const normalizedTitle = textContent?.toUpperCase();
              if (
                normalizedTitle &&
                [
                  "UNIVERSAL",
                  "GEAR FOR EVERY SOUND.",
                  "YOUR NEXT GUITAR STARTS HERE.",
                  "YOUR SOUND HAS A SHAPE.",
                ].includes(normalizedTitle)
              ) {
                delete cleaned.textContent;
              }
              delete cleaned["style.color"];
              delete cleaned["style.backgroundColor"];
            }
            if (
              id === "home-hero-lead" &&
              textContent?.toLowerCase().startsWith("universal music store is an online store")
            ) {
              delete cleaned.textContent;
            }
            return [id, cleaned];
          })
          .filter(([, value]) => Object.keys(value as Record<string, string>).length > 0),
      )
    : undefined;
  return {
    visualBlocks: Array.isArray(raw.visualBlocks)
      ? raw.visualBlocks.filter(
          (block): block is CmsBlock =>
            isRecord(block) &&
            typeof block.id === "string" &&
            typeof block.type === "string" &&
            isRecord(block.props),
        )
      : undefined,
    domOverrides,
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
  const workerUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (workerUrl) {
    try {
      const response = await fetch(`${workerUrl}/storefront/home`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`worker_home_${response.status}`);
      const body = (await response.json()) as {
        home?: unknown;
        page?: { tree?: unknown };
      };
      if (Array.isArray(body.page?.tree) && body.page.tree.length > 0) {
        return mergeCanonicalHomeTree(body.page.tree as CmsNode[]);
      }
      return mergeStorefrontHomePayload(body.home);
    } catch (e) {
      console.warn("[storefront-home-cms] Worker read failed", e);
      return mergeStorefrontHomePayload(null);
    }
  }
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
  const visualBlocks = blocks.filter(
    (block) => block.type === "visual_primitive" || block.componentId?.startsWith("visual:") === true,
  );
  if (visualBlocks.length) raw.visualBlocks = visualBlocks;
  return mergeStorefrontHomePayload(raw);
}
