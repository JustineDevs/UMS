import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export const CMS_ANNOUNCEMENT_DEFAULT_ID = "default";

export type CmsAnnouncementBodyFormat = "plain" | "html";

export type CmsAnnouncementRow = {
  id: string;
  body: string;
  bodyFormat: CmsAnnouncementBodyFormat;
  linkUrl: string | null;
  linkLabel: string | null;
  dismissible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  locale: string;
  priority: number;
  stackGroup: string | null;
  regionCode: string | null;
};

export type CmsAnnouncementAnalyticsRow = {
  announcementId: string;
  locale: string;
  impressions: number;
  clicks: number;
  dismisses: number;
  updatedAt: string;
};

function rowFromDb(r: Record<string, unknown>): CmsAnnouncementRow {
  const fmt = r.body_format === "html" ? "html" : "plain";
  return {
    id: String(r.id ?? CMS_ANNOUNCEMENT_DEFAULT_ID),
    body: String(r.body ?? ""),
    bodyFormat: fmt,
    linkUrl: r.link_url != null ? String(r.link_url) : null,
    linkLabel: r.link_label != null ? String(r.link_label) : null,
    dismissible: Boolean(r.dismissible),
    startsAt: r.starts_at != null ? String(r.starts_at) : null,
    endsAt: r.ends_at != null ? String(r.ends_at) : null,
    locale: String(r.locale ?? "en"),
    priority: typeof r.priority === "number" ? r.priority : Number(r.priority) || 0,
    stackGroup: r.stack_group != null ? String(r.stack_group) : null,
    regionCode: r.region_code != null ? String(r.region_code) : null,
  };
}

function inTimeWindow(startsAt: string | null, endsAt: string | null): boolean {
  const now = Date.now();
  if (startsAt && new Date(startsAt).getTime() > now) return false;
  if (endsAt && new Date(endsAt).getTime() < now) return false;
  return true;
}

/** All announcement rows (admin). */
export async function listCmsAnnouncementsAdmin(supabase: SupabaseClient, organizationId?: string): Promise<CmsAnnouncementRow[]> {
  let query = supabase.from("cms_announcement").select("*");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-announcement] list admin", error.message);
    return [];
  }
  const rows = (data ?? []).map((x) => rowFromDb(x as Record<string, unknown>));
  rows.sort((a, b) => {
    const loc = a.locale.localeCompare(b.locale);
    if (loc !== 0) return loc;
    return b.priority - a.priority;
  });
  return rows;
}

/**
 * Resolved bars for storefront: within each stack_group (or per-id if no group),
 * keep the row with highest priority. Then sort by priority descending.
 */
export function resolveAnnouncementStack(rows: CmsAnnouncementRow[]): CmsAnnouncementRow[] {
  const withBody = rows.filter((r) => r.body.trim().length > 0 && inTimeWindow(r.startsAt, r.endsAt));
  const groups = new Map<string, CmsAnnouncementRow>();
  for (const r of withBody) {
    const key = r.stackGroup?.trim() ? r.stackGroup.trim() : `__id:${r.id}:${r.locale}`;
    const prev = groups.get(key);
    if (!prev || r.priority > prev.priority) groups.set(key, r);
  }
  return Array.from(groups.values()).sort((a, b) => b.priority - a.priority);
}

export async function listCmsAnnouncementsForLocalePublic(
  supabase: SupabaseClient,
  locale: string,
  regionCode?: string | null,
  organizationId?: string,
): Promise<CmsAnnouncementRow[]> {
  let query = supabase.from("cms_announcement").select("*").eq("locale", locale);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    console.error("[cms-announcement] list public", error.message);
    return [];
  }
  const rows = (data ?? []).map((x) => rowFromDb(x as Record<string, unknown>));
  const regionFiltered = rows.filter(
    (r) => !r.regionCode?.trim() || !regionCode?.trim() || r.regionCode.trim() === regionCode.trim(),
  );
  return resolveAnnouncementStack(regionFiltered);
}

/** @deprecated Use listCmsAnnouncementsForLocalePublic; kept for narrow imports. */
export async function getCmsAnnouncement(
  supabase: SupabaseClient,
  locale = "en",
): Promise<CmsAnnouncementRow | null> {
  const list = await listCmsAnnouncementsForLocalePublic(supabase, locale);
  return list[0] ?? null;
}

export type UpsertCmsAnnouncementInput = Partial<
  Pick<
    CmsAnnouncementRow,
    | "body"
    | "bodyFormat"
    | "linkUrl"
    | "linkLabel"
    | "dismissible"
    | "startsAt"
    | "endsAt"
    | "locale"
    | "priority"
    | "stackGroup"
    | "regionCode"
  >
> & { id?: string; organization_id?: string };

export async function upsertCmsAnnouncement(
  supabase: SupabaseClient,
  row: UpsertCmsAnnouncementInput,
): Promise<void> {
  const id = row.id?.trim() || CMS_ANNOUNCEMENT_DEFAULT_ID;
  const locale = row.locale ?? "en";
  const { data: existing } = await supabase
    .from("cms_announcement")
    .select("*")
    .eq("id", id)
    .eq("locale", locale)
    .eq("organization_id", row.organization_id ?? "")
    .maybeSingle();
  const ex = existing ? rowFromDb(existing as Record<string, unknown>) : null;
  const { error } = await supabase.from("cms_announcement").upsert(
    {
      id,
      locale,
      body: row.body ?? ex?.body ?? "",
      body_format: row.bodyFormat ?? ex?.bodyFormat ?? "plain",
      link_url: row.linkUrl !== undefined ? row.linkUrl : ex?.linkUrl ?? null,
      link_label: row.linkLabel !== undefined ? row.linkLabel : ex?.linkLabel ?? null,
      dismissible: row.dismissible ?? ex?.dismissible ?? true,
      starts_at: row.startsAt !== undefined ? row.startsAt : ex?.startsAt ?? null,
      ends_at: row.endsAt !== undefined ? row.endsAt : ex?.endsAt ?? null,
      priority: row.priority ?? ex?.priority ?? 0,
      stack_group: row.stackGroup !== undefined ? row.stackGroup : ex?.stackGroup ?? null,
      region_code: row.regionCode !== undefined ? row.regionCode : ex?.regionCode ?? null,
      organization_id: row.organization_id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,id,locale" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteCmsAnnouncement(
  supabase: SupabaseClient,
  id: string,
  locale: string,
  organizationId?: string,
): Promise<boolean> {
  let query = supabase.from("cms_announcement").delete().eq("id", id).eq("locale", locale);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { error } = await query;
  if (error) {
    console.error("[cms-announcement] delete", error.message);
    return false;
  }
  return true;
}

export async function getCmsAnnouncementAnalyticsMap(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<Map<string, CmsAnnouncementAnalyticsRow>> {
  let query = supabase.from("cms_announcement_analytics").select("*");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return new Map();
    console.error("[cms-announcement] analytics list", error.message);
    return new Map();
  }
  const m = new Map<string, CmsAnnouncementAnalyticsRow>();
  for (const raw of data ?? []) {
    const r = raw as Record<string, unknown>;
    const aid = String(r.announcement_id ?? "");
    const loc = String(r.locale ?? "en");
    m.set(`${aid}:${loc}`, {
      announcementId: aid,
      locale: loc,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      dismisses: Number(r.dismisses) || 0,
      updatedAt: String(r.updated_at ?? ""),
    });
  }
  return m;
}

export async function incrementCmsAnnouncementMetric(
  supabase: SupabaseClient,
  announcementId: string,
  locale: string,
  metric: "impressions" | "clicks" | "dismisses",
  organizationId?: string,
): Promise<void> {
  const key = { announcement_id: announcementId, locale, organization_id: organizationId ?? null };
  let query = supabase
    .from("cms_announcement_analytics")
    .select("*")
    .eq("announcement_id", announcementId)
    .eq("locale", locale);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data: cur } = await query.maybeSingle();
  const r = cur as Record<string, unknown> | null;
  const impressions = Number(r?.impressions) || 0;
  const clicks = Number(r?.clicks) || 0;
  const dismisses = Number(r?.dismisses) || 0;
  const next = {
    ...key,
    impressions: metric === "impressions" ? impressions + 1 : impressions,
    clicks: metric === "clicks" ? clicks + 1 : clicks,
    dismisses: metric === "dismisses" ? dismisses + 1 : dismisses,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("cms_announcement_analytics").upsert(next, {
    onConflict: "organization_id,announcement_id,locale",
  });
  if (error) console.error("[cms-announcement] increment metric", error.message);
}
