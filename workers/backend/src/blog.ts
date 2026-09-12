import type { WorkerDatabaseClient } from "./database.ts";

type BlogRow = { id: string; slug: string; locale: string; title: string; excerpt: string; body: string; cover_image_url: string | null; author_name: string | null; tags: string[]; status: string; published_at: string | null; scheduled_publish_at: string | null; meta_title: string | null; meta_description: string | null; og_image_url: string | null; json_ld: unknown; created_at: string; updated_at: string };

function visible(row: BlogRow): boolean {
  const time = Date.now();
  return (row.status === "published" && (!row.published_at || Date.parse(row.published_at) <= time)) || (row.status === "scheduled" && Boolean(row.scheduled_publish_at) && Date.parse(row.scheduled_publish_at as string) <= time);
}

const fields = `id, slug, locale, title, excerpt, body, cover_image_url, author_name, tags, status, published_at, scheduled_publish_at, meta_title, meta_description, og_image_url, json_ld, created_at, updated_at`;

export async function getPublishedBlogPost(database: WorkerDatabaseClient, slug: string, locale: string, organizationId: string): Promise<BlogRow | null> {
  const result = await database.query<BlogRow>(`SELECT ${fields} FROM public.cms_blog_posts WHERE organization_id = $1 AND slug = $2 AND locale = $3 LIMIT 1`, [organizationId, slug, locale]);
  const row = result.rows[0];
  return row && visible(row) ? row : null;
}

export async function listPublishedBlogPosts(database: WorkerDatabaseClient, locale: string, organizationId: string): Promise<BlogRow[]> {
  const result = await database.query<BlogRow>(`SELECT ${fields} FROM public.cms_blog_posts WHERE organization_id = $1 AND locale = $2 ORDER BY published_at DESC NULLS LAST, updated_at DESC`, [organizationId, locale]);
  return result.rows.filter(visible);
}

export async function handleBlogRequest(request: Request, database: WorkerDatabaseClient, organizationId: string | undefined, slug?: string): Promise<Response> {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json", Allow: "GET" } });
  const tenant = organizationId?.trim();
  if (!tenant) return new Response(JSON.stringify({ error: "organization_not_configured" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale")?.trim() || "en";
  if (locale.length > 32 || slug && (slug.length === 0 || slug.length > 255)) return new Response(JSON.stringify({ error: "invalid_blog_reference" }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (slug) {
    const post = await getPublishedBlogPost(database, slug, locale, tenant);
    return post ? new Response(JSON.stringify({ post }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } }) : new Response(JSON.stringify({ type: "not_found", message: "Post not found" }), { status: 404, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  const posts = await listPublishedBlogPosts(database, locale, tenant);
  return new Response(JSON.stringify({ posts }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } });
}
