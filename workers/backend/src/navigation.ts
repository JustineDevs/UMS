import type { WorkerDatabaseClient } from "./database.ts";

type Link = {
  href: string;
  label: string;
  startsAt?: string;
  endsAt?: string;
  [key: string]: unknown;
};
type NavigationRow = {
  header_links: unknown;
  header_links_mobile: unknown;
  footer_columns: unknown;
  footer_bottom_links: unknown;
  social_links: unknown;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function link(value: unknown): Link | null {
  if (!record(value) || typeof value.href !== "string" || typeof value.label !== "string") return null;
  return { ...value, href: value.href, label: value.label };
}

function links(value: unknown): Link[] {
  if (!Array.isArray(value)) return [];
  return value.map(link).filter((item): item is Link => item !== null).map((item) => ({
    ...item,
    ...(Array.isArray(item.children)
      ? { children: links(item.children) }
      : {}),
  }));
}

function visible(item: Link, now: number): boolean {
  const starts = item.startsAt ? Date.parse(item.startsAt) : NaN;
  const ends = item.endsAt ? Date.parse(item.endsAt) : NaN;
  return (Number.isNaN(starts) || starts <= now) && (Number.isNaN(ends) || ends >= now);
}

function filterLinks(items: Link[], now: number): Link[] {
  return items.filter((item) => visible(item, now)).map((item) => ({
    ...item,
    ...(Array.isArray(item.children) ? { children: filterLinks(item.children as Link[], now) } : {}),
  }));
}

function filterColumns(value: unknown, now: number): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.filter(record).map((column) => ({
    ...column,
    links: filterLinks(links(column.links), now),
  }));
}

export async function getPublishedNavigation(
  database: WorkerDatabaseClient,
  organizationId: string,
): Promise<Record<string, unknown> | null> {
  const result = await database.query<NavigationRow>(
    `SELECT header_links, header_links_mobile, footer_columns, footer_bottom_links, social_links
       FROM public.cms_navigation
      WHERE organization_id = $1 AND id = 'default'
      LIMIT 1`,
    [organizationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const now = Date.now();
  return {
    headerLinks: filterLinks(links(row.header_links), now),
    headerLinksMobile: filterLinks(links(row.header_links_mobile), now),
    footerColumns: filterColumns(row.footer_columns, now),
    footerBottomLinks: filterLinks(links(row.footer_bottom_links), now),
    socialLinks: Array.isArray(row.social_links) ? row.social_links.filter(record) : [],
  };
}

export async function handleNavigationRequest(
  request: Request,
  database: WorkerDatabaseClient,
  organizationId: string | undefined,
): Promise<Response> {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json", Allow: "GET" } });
  const tenant = organizationId?.trim();
  if (!tenant) return new Response(JSON.stringify({ error: "organization_not_configured" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const navigation = await getPublishedNavigation(database, tenant);
  if (!navigation) return new Response(JSON.stringify({ navigation: { headerLinks: [], headerLinksMobile: [], footerColumns: [], footerBottomLinks: [], socialLinks: [] } }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=60" } });
  return new Response(JSON.stringify({ navigation }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } });
}
