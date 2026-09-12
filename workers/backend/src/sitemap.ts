import type { WorkerDatabaseClient } from "./database.ts";

type SitemapRow = { slug: string; locale: string; updated_at: string; kind: "page" | "post"; status: string; published_at: string | null; scheduled_publish_at: string | null };

function visible(row: SitemapRow): boolean {
  const now = Date.now();
  return (row.status === "published" && (!row.published_at || Date.parse(row.published_at) <= now)) || (row.status === "scheduled" && Boolean(row.scheduled_publish_at) && Date.parse(row.scheduled_publish_at as string) <= now);
}

export async function listNativeCmsSitemap(database: WorkerDatabaseClient, organizationId: string): Promise<SitemapRow[]> {
  const result = await database.query<SitemapRow>(`SELECT slug, locale, updated_at, 'page' AS kind, status, published_at, scheduled_publish_at FROM public.cms_pages WHERE organization_id = $1 UNION ALL SELECT slug, locale, updated_at, 'post' AS kind, status, published_at, scheduled_publish_at FROM public.cms_blog_posts WHERE organization_id = $1`, [organizationId]);
  return result.rows.filter(visible).map(({ slug, locale, updated_at, kind }) => ({ slug, locale, updated_at, kind, status: "published", published_at: null, scheduled_publish_at: null }));
}

export async function handleSitemapRequest(request: Request, database: WorkerDatabaseClient, organizationId: string | undefined): Promise<Response> {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json", Allow: "GET" } });
  const tenant = organizationId?.trim();
  if (!tenant) return new Response(JSON.stringify({ error: "organization_not_configured" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const entries = await listNativeCmsSitemap(database, tenant);
  return new Response(JSON.stringify({ entries }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900" } });
}
