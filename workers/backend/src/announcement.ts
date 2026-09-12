import type { WorkerDatabaseClient } from "./database.ts";

type Announcement = { id: string; body: string; body_format: "plain" | "html"; link_url: string | null; link_label: string | null; dismissible: boolean; starts_at: string | null; ends_at: string | null; locale: string; priority: number | string; stack_group: string | null; region_code: string | null };

function active(row: Announcement, now: number, region: string | null): boolean {
  const start = row.starts_at ? Date.parse(row.starts_at) : NaN;
  const end = row.ends_at ? Date.parse(row.ends_at) : NaN;
  return Boolean(row.body.trim()) && (Number.isNaN(start) || start <= now) && (Number.isNaN(end) || end >= now) && (!row.region_code || !region || row.region_code === region);
}

export async function getPublishedAnnouncements(database: WorkerDatabaseClient, organizationId: string, locale: string, region: string | null): Promise<Announcement[]> {
  const result = await database.query<Announcement>(
    `SELECT id, body, body_format, link_url, link_label, dismissible, starts_at, ends_at, locale, priority, stack_group, region_code
       FROM public.cms_announcement WHERE organization_id = $1 AND locale = $2`,
    [organizationId, locale],
  );
  const groups = new Map<string, Announcement>();
  for (const row of result.rows.filter((item) => active(item, Date.now(), region))) {
    const key = row.stack_group?.trim() || `${row.id}:${row.locale}`;
    const previous = groups.get(key);
    if (!previous || Number(row.priority) > Number(previous.priority)) groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => Number(b.priority) - Number(a.priority));
}

export async function handleAnnouncementRequest(request: Request, database: WorkerDatabaseClient, organizationId: string | undefined): Promise<Response> {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json", Allow: "GET" } });
  const tenant = organizationId?.trim();
  if (!tenant) return new Response(JSON.stringify({ error: "organization_not_configured" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale")?.trim() || "en";
  const region = url.searchParams.get("region")?.trim() || null;
  if (locale.length > 32 || region && region.length > 32) return new Response(JSON.stringify({ error: "invalid_locale_or_region" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const announcements = await getPublishedAnnouncements(database, tenant, locale, region);
  return new Response(JSON.stringify({ announcements }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=120" } });
}
