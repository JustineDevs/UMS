import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";
import type {
  CmsFooterColumn,
  CmsNavFeatured,
  CmsNavLink,
  CmsNavigationPayload,
  CmsSocialLink,
} from "./cms-types.js";

const DEFAULT_ID = "default";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseFeatured(v: unknown): CmsNavFeatured | undefined {
  if (!isRecord(v)) return undefined;
  const href = typeof v.href === "string" ? v.href : "";
  const label = typeof v.label === "string" ? v.label : "";
  if (!href || !label) return undefined;
  return {
    href,
    label,
    imageUrl: typeof v.imageUrl === "string" ? v.imageUrl : undefined,
  };
}

export function parseNavLink(v: unknown): CmsNavLink | null {
  if (!isRecord(v)) return null;
  const href = typeof v.href === "string" ? v.href : "";
  const label = typeof v.label === "string" ? v.label : "";
  if (!href || !label) return null;
  const childrenRaw = Array.isArray(v.children) ? v.children : [];
  const children = childrenRaw
    .map(parseNavLink)
    .filter((x): x is CmsNavLink => x != null);
  const featured = parseFeatured(v.featured);
  return {
    href,
    label,
    badge: typeof v.badge === "string" ? v.badge : undefined,
    iconKey: typeof v.iconKey === "string" ? v.iconKey : undefined,
    children: children.length ? children : undefined,
    featured,
    startsAt: typeof v.startsAt === "string" ? v.startsAt : undefined,
    endsAt: typeof v.endsAt === "string" ? v.endsAt : undefined,
  };
}

function parseLinks(v: unknown): CmsNavLink[] {
  if (!Array.isArray(v)) return [];
  const out: CmsNavLink[] = [];
  for (const x of v) {
    const l = parseNavLink(x);
    if (l) out.push(l);
  }
  return out;
}

function linkVisibleAt(link: CmsNavLink, now: number): boolean {
  if (link.startsAt) {
    const t = Date.parse(link.startsAt);
    if (!Number.isNaN(t) && t > now) return false;
  }
  if (link.endsAt) {
    const t = Date.parse(link.endsAt);
    if (!Number.isNaN(t) && t < now) return false;
  }
  return true;
}

function filterNavLinksBySchedule(links: CmsNavLink[], now: number): CmsNavLink[] {
  return links
    .filter((l) => linkVisibleAt(l, now))
    .map((l) => ({
      ...l,
      children: l.children?.length
        ? filterNavLinksBySchedule(l.children, now)
        : undefined,
    }));
}

function parseFooter(v: unknown): CmsFooterColumn[] {
  if (!Array.isArray(v)) return [];
  const out: CmsFooterColumn[] = [];
  for (const x of v) {
    if (x && typeof x === "object" && "title" in x) {
      const r = x as Record<string, unknown>;
      out.push({
        title: String(r.title ?? ""),
        links: parseLinks(r.links),
      });
    }
  }
  return out;
}

function parseSocial(v: unknown): CmsSocialLink[] {
  if (!Array.isArray(v)) return [];
  const out: CmsSocialLink[] = [];
  for (const x of v) {
    if (x && typeof x === "object" && "href" in x && "label" in x) {
      const r = x as Record<string, unknown>;
      out.push({
        href: String(r.href ?? ""),
        label: String(r.label ?? ""),
        network: r.network != null ? String(r.network) : undefined,
      });
    }
  }
  return out;
}

function emptyPayload(): CmsNavigationPayload {
  return {
    headerLinks: [],
    headerLinksMobile: [],
    footerColumns: [],
    footerBottomLinks: [],
    socialLinks: [],
  };
}

function rowToPayload(
  row: Record<string, unknown>,
  opts?: { filterSchedule?: boolean },
): CmsNavigationPayload {
  const base: CmsNavigationPayload = {
    headerLinks: parseLinks(row.header_links),
    headerLinksMobile: parseLinks(row.header_links_mobile),
    footerColumns: parseFooter(row.footer_columns),
    footerBottomLinks: parseLinks(row.footer_bottom_links),
    socialLinks: parseSocial(row.social_links),
  };
  if (opts?.filterSchedule) {
    const now = Date.now();
    return {
      ...base,
      headerLinks: filterNavLinksBySchedule(base.headerLinks, now),
      headerLinksMobile: filterNavLinksBySchedule(base.headerLinksMobile, now),
      footerBottomLinks: filterNavLinksBySchedule(base.footerBottomLinks, now),
    };
  }
  return base;
}

/** Public storefront: schedule windows applied. */
export async function getCmsNavigationPayload(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<CmsNavigationPayload> {
  let query = supabase
    .from("cms_navigation")
    .select("header_links, header_links_mobile, footer_columns, footer_bottom_links, social_links")
    .eq("id", DEFAULT_ID);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) {
      return emptyPayload();
    }
    console.error("[cms-navigation] getCmsNavigationPayload", error.message);
    return emptyPayload();
  }
  if (!data) return emptyPayload();
  return rowToPayload(data as Record<string, unknown>, { filterSchedule: true });
}

/** Admin + publish: raw links without schedule filtering. */
export async function getCmsNavigationPayloadAdmin(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<CmsNavigationPayload> {
  let query = supabase
    .from("cms_navigation")
    .select("header_links, header_links_mobile, footer_columns, footer_bottom_links, social_links")
    .eq("id", DEFAULT_ID);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) {
      return emptyPayload();
    }
    console.error("[cms-navigation] getCmsNavigationPayloadAdmin", error.message);
    return emptyPayload();
  }
  if (!data) return emptyPayload();
  return rowToPayload(data as Record<string, unknown>, { filterSchedule: false });
}

export type CmsNavigationDraftPayload = Partial<CmsNavigationPayload> & {
  headerLinks?: CmsNavLink[];
  footerColumns?: CmsFooterColumn[];
  socialLinks?: CmsSocialLink[];
  headerLinksMobile?: CmsNavLink[];
  footerBottomLinks?: CmsNavLink[];
};

export async function getCmsNavigationDraftPayload(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<CmsNavigationDraftPayload | null> {
  let query = supabase
    .from("cms_navigation_draft")
    .select("payload")
    .eq("id", DEFAULT_ID);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingTableOrSchemaError(error)) return null;
    console.error("[cms-navigation] getCmsNavigationDraftPayload", error.message);
    return null;
  }
  if (!data) return null;
  const raw = (data as Record<string, unknown>).payload;
  if (!isRecord(raw)) return null;
  const keys = Object.keys(raw).filter((k) => {
    const v = raw[k];
    if (Array.isArray(v)) return v.length > 0;
    return v != null && v !== "";
  });
  if (keys.length === 0) return null;
  return raw as CmsNavigationDraftPayload;
}

/** Merge draft partial over live for the editor initial state. */
export function mergeNavigationDraftOverLive(
  live: CmsNavigationPayload,
  draft: CmsNavigationDraftPayload | null,
): CmsNavigationPayload {
  if (!draft) return live;
  return {
    headerLinks: draft.headerLinks ?? live.headerLinks,
    headerLinksMobile: draft.headerLinksMobile ?? live.headerLinksMobile,
    footerColumns: draft.footerColumns ?? live.footerColumns,
    footerBottomLinks: draft.footerBottomLinks ?? live.footerBottomLinks,
    socialLinks: draft.socialLinks ?? live.socialLinks,
  };
}

export async function upsertCmsNavigationDraftPayload(
  supabase: SupabaseClient,
  payload: CmsNavigationDraftPayload,
  organizationId?: string,
): Promise<void> {
  const { error } = await supabase.from("cms_navigation_draft").upsert(
    {
      id: DEFAULT_ID,
      payload: payload as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
      organization_id: organizationId ?? null,
    },
    { onConflict: "organization_id,id" },
  );
  if (error) throw new Error(error.message);
}

export async function publishCmsNavigationDraft(supabase: SupabaseClient, organizationId?: string): Promise<CmsNavigationPayload> {
  const draft = await getCmsNavigationDraftPayload(supabase, organizationId);
  if (!draft || Object.keys(draft).length === 0) {
    return getCmsNavigationPayloadAdmin(supabase, organizationId);
  }
  const live = await getCmsNavigationPayloadAdmin(supabase, organizationId);
  const merged = mergeNavigationDraftOverLive(live, draft);
  await upsertCmsNavigationPayload(supabase, merged, organizationId);
  await supabase
    .from("cms_navigation_draft")
    .upsert(
      { id: DEFAULT_ID, payload: {}, updated_at: new Date().toISOString(), organization_id: organizationId ?? null },
      { onConflict: "organization_id,id" },
    );
  return merged;
}

function serializeNavLink(l: CmsNavLink): Record<string, unknown> {
  const o: Record<string, unknown> = {
    href: l.href,
    label: l.label,
  };
  if (l.badge) o.badge = l.badge;
  if (l.iconKey) o.iconKey = l.iconKey;
  if (l.startsAt) o.startsAt = l.startsAt;
  if (l.endsAt) o.endsAt = l.endsAt;
  if (l.featured) o.featured = l.featured;
  if (l.children?.length) o.children = l.children.map(serializeNavLink);
  return o;
}

export async function upsertCmsNavigationPayload(
  supabase: SupabaseClient,
  payload: CmsNavigationPayload,
  organizationId?: string,
): Promise<void> {
  const { error } = await supabase.from("cms_navigation").upsert(
    {
      id: DEFAULT_ID,
      header_links: payload.headerLinks.map(serializeNavLink) as unknown as Record<
        string,
        unknown
      >[],
      header_links_mobile: payload.headerLinksMobile.map(serializeNavLink) as unknown as Record<
        string,
        unknown
      >[],
      footer_columns: payload.footerColumns.map((c) => ({
        title: c.title,
        links: c.links.map(serializeNavLink),
      })) as unknown as Record<string, unknown>[],
      footer_bottom_links: payload.footerBottomLinks.map(serializeNavLink) as unknown as Record<
        string,
        unknown
      >[],
      social_links: payload.socialLinks as unknown as Record<string, unknown>[],
      updated_at: new Date().toISOString(),
      organization_id: organizationId ?? null,
    },
    { onConflict: "organization_id,id" },
  );
  if (error) throw new Error(error.message);
}

/** Backward compat: accept partial payloads from older clients. */
export function normalizeNavigationPayloadInput(raw: unknown): CmsNavigationPayload {
  if (!isRecord(raw)) return emptyPayload();
  const headerLinks = parseLinks(raw.headerLinks);
  const headerLinksMobile = parseLinks(raw.headerLinksMobile);
  const footerColumns = parseFooter(raw.footerColumns);
  const footerBottomLinks = parseLinks(raw.footerBottomLinks);
  const socialLinks = parseSocial(raw.socialLinks);
  return {
    headerLinks,
    headerLinksMobile,
    footerColumns,
    footerBottomLinks,
    socialLinks,
  };
}
