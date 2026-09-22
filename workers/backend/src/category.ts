import type { WorkerDatabaseClient } from "./database.ts";

type CategoryRow = { id: string; collection_id: string | null; collection_handle: string; locale: string; intro_html: string; banner_url: string | null; banner_alt: string | null; blocks: unknown; updated_at: string };
const MAX_PUBLIC_CATEGORY_CONTENT = 500;

export async function getCategoryContent(database: WorkerDatabaseClient, handle: string, locale: string, organizationId: string): Promise<CategoryRow | null> {
  const result = await database.query<CategoryRow>(`SELECT id, collection_id, collection_handle, locale, intro_html, banner_url, banner_alt, blocks, updated_at FROM public.cms_category_content WHERE organization_id = $1 AND collection_handle = $2 AND locale = $3 LIMIT 1`, [organizationId, handle, locale]);
  return result.rows[0] ?? null;
}

export async function listCategoryContent(database: WorkerDatabaseClient, locale: string, organizationId: string): Promise<CategoryRow[]> {
  const result = await database.query<CategoryRow>(`SELECT id, collection_id, collection_handle, locale, intro_html, banner_url, banner_alt, blocks, updated_at FROM public.cms_category_content WHERE organization_id = $1 AND locale = $2 ORDER BY collection_handle, id LIMIT ${MAX_PUBLIC_CATEGORY_CONTENT}`, [organizationId, locale]);
  return result.rows;
}

export async function handleCategoryRequest(request: Request, database: WorkerDatabaseClient, organizationId: string | undefined, handle?: string): Promise<Response> {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json", Allow: "GET" } });
  const tenant = organizationId?.trim();
  if (!tenant) return new Response(JSON.stringify({ error: "organization_not_configured" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const locale = new URL(request.url).searchParams.get("locale")?.trim() || "en";
  if (locale.length > 32 || (handle !== undefined && (!handle || handle.length > 255))) return new Response(JSON.stringify({ error: "invalid_category_reference" }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (handle === undefined) {
    const contents = await listCategoryContent(database, locale, tenant);
    return new Response(JSON.stringify({ contents }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } });
  }
  const content = await getCategoryContent(database, handle, locale, tenant);
  return content ? new Response(JSON.stringify({ content }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } }) : new Response(JSON.stringify({ type: "not_found", message: "Category content not found" }), { status: 404, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
