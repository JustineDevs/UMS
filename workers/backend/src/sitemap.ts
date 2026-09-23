import type { WorkerDatabaseClient } from "./database.ts";

type SitemapRow = { slug: string; locale: string; updated_at: string; kind: "page" | "post"; status: string; published_at: string | null; scheduled_publish_at: string | null };
const MAX_NATIVE_SITEMAP_ENTRIES = 5_000;
const PUBLIC_SITEMAP_PATHS = [
  "",
  "/shop",
  "/collections",
  "/about",
  "/search",
  "/blog",
  "/contact",
  "/help",
  "/faq",
  "/privacy",
  "/terms",
  "/site-map",
  "/cookies",
  "/accessibility",
  "/shipping",
  "/returns",
  "/warranty",
  "/variant-guide",
  "/preferences",
] as const;

function visible(row: SitemapRow): boolean {
  const now = Date.now();
  return (row.status === "published" && (!row.published_at || Date.parse(row.published_at) <= now)) || (row.status === "scheduled" && Boolean(row.scheduled_publish_at) && Date.parse(row.scheduled_publish_at as string) <= now);
}

export async function listNativeCmsSitemap(database: WorkerDatabaseClient, organizationId: string): Promise<SitemapRow[]> {
  const result = await database.query<SitemapRow>(`SELECT slug, locale, updated_at, 'page' AS kind, status, published_at, scheduled_publish_at FROM public.cms_pages WHERE organization_id = $1 UNION ALL SELECT slug, locale, updated_at, 'post' AS kind, status, published_at, scheduled_publish_at FROM public.cms_blog_posts WHERE organization_id = $1 ORDER BY updated_at DESC, slug LIMIT ${MAX_NATIVE_SITEMAP_ENTRIES}`, [organizationId]);
  return result.rows.filter(visible).map(({ slug, locale, updated_at, kind }) => ({ slug, locale, updated_at, kind, status: "published", published_at: null, scheduled_publish_at: null }));
}

export async function handleSitemapRequest(request: Request, database: WorkerDatabaseClient, organizationId: string | undefined): Promise<Response> {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json", Allow: "GET" } });
  const tenant = organizationId?.trim();
  if (!tenant) return new Response(JSON.stringify({ error: "organization_not_configured" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const entries = await listNativeCmsSitemap(database, tenant);
  return new Response(JSON.stringify({ entries }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900" } });
}

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

export async function handleSitemapXmlRequest(
  request: Request,
  database: WorkerDatabaseClient,
  organizationId: string | undefined,
  publicSiteUrl?: string,
): Promise<Response> {
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const tenant = organizationId?.trim();
  if (!tenant) {
    return new Response("Sitemap unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const base = (publicSiteUrl?.trim() || new URL(request.url).origin).replace(/\/$/, "");
  const urls = new Set(PUBLIC_SITEMAP_PATHS.map((path) => `${base}${path}`));
  const entries = await listNativeCmsSitemap(database, tenant);
  for (const entry of entries) {
    const prefix = entry.kind === "post" ? "/blog/" : "/p/";
    urls.add(`${base}${prefix}${encodeURIComponent(entry.slug)}`);
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...Array.from(urls, (url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
    "</urlset>",
  ].join("\n");
  return new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
