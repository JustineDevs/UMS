import type { WorkerDatabaseClient } from "./database.ts";
import { getPublishedCmsPage } from "./cms.ts";

type JsonRecord = Record<string, unknown>;

function json(
  body: JsonRecord,
  cacheControl = "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": cacheControl },
  });
}

function record(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function payload(value: unknown): JsonRecord {
  return record(value) ? value : {};
}

export async function handleStorefrontMetadataRequest(
  request: Request,
  database: WorkerDatabaseClient,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "GET" },
    });
  }
  const result = await database.query<{ payload: unknown }>(
    "SELECT payload FROM public.storefront_public_metadata WHERE id = $1 LIMIT 1",
    ["default"],
  );
  return json({ metadata: payload(result.rows[0]?.payload) });
}

/** Published CMS home content is authoritative; the legacy row is a read fallback. */
export async function handleStorefrontHomeRequest(
  request: Request,
  database: WorkerDatabaseClient,
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
  const page = await getPublishedCmsPage(database, "home", "en", tenant);
  if (page && Array.isArray(page.tree) && page.tree.length > 0) {
    return json({ page });
  }
  const legacy = await database.query<{ payload: unknown }>(
    "SELECT payload FROM public.storefront_home_content WHERE id = $1 LIMIT 1",
    ["default"],
  );
  return json({ home: payload(legacy.rows[0]?.payload) });
}
