import type { WorkerDatabaseClient } from "./database.ts";

type CmsPageRow = {
  id: string;
  organization_id: string;
  slug: string;
  locale: string;
  page_type: string;
  title: string;
  body: string;
  blocks: unknown;
  tree: unknown;
  status: string;
  published_at: string | null;
  scheduled_publish_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
  json_ld: unknown;
  version: number | string;
  updated_at: string;
};

export type CmsPublicPage = Omit<CmsPageRow, "version"> & { version: number };

function publicNow(status: string, publishedAt: string | null, scheduledAt: string | null): boolean {
  const now = Date.now();
  if (status === "published") return !publishedAt || Date.parse(publishedAt) <= now;
  return status === "scheduled" && scheduledAt !== null && Date.parse(scheduledAt) <= now;
}

export async function getPublishedCmsPage(
  database: WorkerDatabaseClient,
  slug: string,
  locale: string,
  organizationId: string,
): Promise<CmsPublicPage | null> {
  const result = await database.query<CmsPageRow>(
    `SELECT id, organization_id, slug, locale, page_type, title, body, blocks, tree,
            status, published_at, scheduled_publish_at, meta_title, meta_description,
            canonical_url, og_image_url, json_ld, version, updated_at
       FROM public.cms_pages
      WHERE organization_id = $1 AND slug = $2 AND locale = $3
      LIMIT 1`,
    [organizationId, slug, locale],
  );
  const row = result.rows[0];
  if (!row || !publicNow(row.status, row.published_at, row.scheduled_publish_at)) return null;
  return { ...row, version: Number(row.version) || 1 };
}

export async function handleCmsPageRequest(
  request: Request,
  database: WorkerDatabaseClient,
  slug: string,
  organizationId: string | undefined,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "GET" },
    });
  }
  const tenant = organizationId?.trim();
  if (!tenant) {
    return new Response(JSON.stringify({ error: "organization_not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const locale = new URL(request.url).searchParams.get("locale")?.trim() || "en";
  if (!slug || slug.length > 255 || locale.length > 32) {
    return new Response(JSON.stringify({ error: "invalid_page_reference" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const page = await getPublishedCmsPage(database, slug, locale, tenant);
  if (!page) {
    return new Response(JSON.stringify({ type: "not_found", message: "Page not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  return new Response(JSON.stringify({ page }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
