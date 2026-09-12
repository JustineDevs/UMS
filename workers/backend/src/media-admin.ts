import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string; SUPABASE_STORAGE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((value) => value === "*" || value === "content:read" || value === "catalog:read" || value === "catalog:write") || claims.role === "owner" || claims.role === "admin"; }
function safeLimit(value: string | null): number { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200; }
function safeSort(value: string | null): "created_at ASC" | "display_name ASC" | "display_name DESC" | "created_at DESC" { return value === "created_asc" ? "created_at ASC" : value === "name_asc" ? "display_name ASC" : value === "name_desc" ? "display_name DESC" : "created_at DESC"; }

function safeSegment(value: string): string { return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload"; }

type MediaRow = {
  id: string;
  storage_path: string;
  public_url: string;
  tags: string[];
};

type ReferenceHit = { source: string; detail: string };

async function findMediaReferences(database: WorkerDatabaseClient, publicUrl: string, organizationId: string, medusa: boolean): Promise<ReferenceHit[]> {
  const hits: ReferenceHit[] = [];
  const needle = publicUrl.trim();
  if (!needle) return hits;
  const queries = medusa
    ? [{ text: "SELECT id, title, handle, to_jsonb(product) AS payload FROM public.product WHERE COALESCE(to_jsonb(product)::text, '') LIKE $1 LIMIT 500", source: "medusa_product" }]
    : [
        { text: "SELECT slug, locale, body, og_image_url, to_jsonb(cms_pages) AS payload FROM public.cms_pages WHERE organization_id = $2 AND (COALESCE(body, '') LIKE $1 OR COALESCE(og_image_url, '') LIKE $1 OR to_jsonb(cms_pages)::text LIKE $1) LIMIT 500", source: "cms_pages" },
        { text: "SELECT collection_handle, locale, to_jsonb(cms_category_content) AS payload FROM public.cms_category_content WHERE organization_id = $2 AND to_jsonb(cms_category_content)::text LIKE $1 LIMIT 500", source: "cms_category_content" },
        { text: "SELECT slug, locale, to_jsonb(cms_blog_posts) AS payload FROM public.cms_blog_posts WHERE organization_id = $2 AND to_jsonb(cms_blog_posts)::text LIKE $1 LIMIT 500", source: "cms_blog_posts" },
        { text: "SELECT id, to_jsonb(cms_navigation) AS payload FROM public.cms_navigation WHERE organization_id = $2 AND to_jsonb(cms_navigation)::text LIKE $1 LIMIT 100", source: "cms_navigation" },
        { text: "SELECT component_key, id, to_jsonb(cms_component_definitions) AS payload FROM public.cms_component_definitions WHERE organization_id = $2 AND to_jsonb(cms_component_definitions)::text LIKE $1 LIMIT 500", source: "cms_component_definitions" },
        { text: "SELECT id, to_jsonb(storefront_home_content) AS payload FROM public.storefront_home_content WHERE organization_id = $2 AND to_jsonb(storefront_home_content)::text LIKE $1 LIMIT 100", source: "storefront_home_content" },
      ];
  for (const query of queries) {
    try {
      const result = await database.query<Record<string, unknown>>(query.text, medusa ? [`%${needle}%`] : [`%${needle}%`, organizationId]);
      for (const row of result.rows) {
        const detail = medusa
          ? `${String(row.title ?? row.handle ?? row.id ?? "product")} (${String(row.id ?? "")})`
          : `${String(row.slug ?? row.collection_handle ?? row.component_key ?? row.id ?? "default")} (${String(row.locale ?? "")})`;
        hits.push({ source: query.source, detail });
      }
    } catch {
      // Optional CMS tables vary by migration level. A missing table is not a reason
      // to fail a delete, but an existing table is always scanned before deletion.
    }
  }
  return hits;
}

async function mediaById(database: WorkerDatabaseClient, id: string, organizationId: string): Promise<MediaRow | null> {
  const result = await database.query<MediaRow>(
    "SELECT id, storage_path, public_url, tags FROM public.cms_media WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL LIMIT 1",
    [id, organizationId],
  );
  const row = result.rows[0];
  return row ? { ...row, tags: Array.isArray(row.tags) ? row.tags.map(String) : [] } : null;
}

export async function handleCmsAdminMediaDeleteRequest(request: Request, appDatabase: WorkerDatabaseClient, medusaDatabase: WorkerDatabaseClient, env: Env, mediaId: string): Promise<Response> {
  if (request.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  if (!(claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "content:write" || value === "catalog:write"))) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(mediaId)) return json({ error: "invalid_media_id" }, 400);
  const row = await mediaById(appDatabase, mediaId, organizationId);
  if (!row) return json({ error: "not_found" }, 404);
  const isCatalog = row.tags.includes("catalog-product");
  if (!(claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "content:write" || (isCatalog && value === "catalog:write")))) return json({ error: "forbidden" }, 403);
  const [cmsReferences, medusaReferences] = await Promise.all([
    findMediaReferences(appDatabase, row.public_url, organizationId, false),
    findMediaReferences(medusaDatabase, row.public_url, organizationId, true),
  ]);
  const references = [...cmsReferences, ...medusaReferences];
  if (references.length > 0) return json({ error: "media_in_use", references }, 409);
  const deleted = await appDatabase.query("UPDATE public.cms_media SET deleted_at = now() WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL", [mediaId, organizationId]);
  if (!deleted.rowCount) return json({ error: "delete_conflict" }, 409);
  const storageUrl = env.SUPABASE_STORAGE_URL ?? env.SUPABASE_URL;
  const external = row.storage_path.startsWith("external/");
  if (external || !storageUrl || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: true, storageCleanup: external ? "skipped" : "pending" });
  const bucket = isCatalog ? "catalog" : "cms";
  const storage = await fetch(`${storageUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${row.storage_path}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY } });
  return json({ ok: true, storageCleanup: storage.ok ? "removed" : "pending" });
}

export async function handleCmsAdminMediaUploadRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  if (!(claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "catalog:write"))) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const storageUrl = env.SUPABASE_STORAGE_URL ?? env.SUPABASE_URL;
  if (!storageUrl || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "storage_not_configured" }, 503);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "invalid_form_data" }, 400); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 100 * 1024 * 1024) return json({ error: "invalid_file_size" }, 400);
  const mime = file.type.trim().toLowerCase();
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime", "video/ogg"]);
  if (!allowed.has(mime)) return json({ error: "unsupported_media_type" }, 400);
  const safeName = safeSegment(file.name);
  const productId = typeof form.get("productId") === "string" ? safeSegment(form.get("productId") as string) : "";
  const path = `${productId ? `products/${productId}` : "public"}/${crypto.randomUUID()}-${safeName}`;
  const storage = await fetch(`${storageUrl.replace(/\/$/, "")}/storage/v1/object/catalog/${path}`, { method: "POST", headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": mime, "x-upsert": "false" }, body: await file.arrayBuffer() });
  if (!storage.ok) return json({ error: "media_upload_failed" }, 502);
  const publicUrl = `${storageUrl.replace(/\/$/, "")}/storage/v1/object/public/catalog/${path}`;
  const altText = mime.startsWith("image/") ? (typeof form.get("alt") === "string" && (form.get("alt") as string).trim() ? (form.get("alt") as string).trim().slice(0, 500) : `Product image: ${safeName.replace(/\.[^.]+$/, "")}`) : null;
  const result = await database.query(`INSERT INTO public.cms_media (organization_id,storage_path,public_url,alt_text,mime_type,display_name,byte_size,tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[]) RETURNING id,storage_path,public_url,alt_text,mime_type,display_name,byte_size,tags,created_at`, [organizationId, path, publicUrl, altText, mime, safeName, file.size, ["catalog-product"]]);
  if (!result.rows[0]) { await fetch(`${storageUrl.replace(/\/$/, "")}/storage/v1/object/catalog/${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY } }).catch(() => undefined); return json({ error: "media_metadata_failed" }, 502); }
  return json({ data: result.rows[0] }, 201);
}
export async function handleCmsAdminMediaListRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const params = new URL(request.url).searchParams;
  const values: unknown[] = [organizationId];
  const clauses = ["organization_id = $1", "deleted_at IS NULL"];
  if (params.get("q")?.trim()) { values.push(`%${params.get("q")!.trim()}%`); clauses.push(`(public_url ILIKE $${values.length} OR display_name ILIKE $${values.length} OR alt_text ILIKE $${values.length})`); }
  if (params.get("mime")?.trim()) { values.push(`${params.get("mime")!.trim()}%`); clauses.push(`mime_type ILIKE $${values.length}`); }
  if (params.get("tag")?.trim()) { values.push(params.get("tag")!.trim()); clauses.push(`$${values.length} = ANY(tags)`); }
  values.push(safeLimit(params.get("limit")));
  const result = await database.query(`SELECT id, storage_path, public_url, alt_text, mime_type, width, height, created_at, deleted_at, display_name, byte_size, tags, organization_id FROM public.cms_media WHERE ${clauses.join(" AND ")} ORDER BY ${safeSort(params.get("sort"))} LIMIT $${values.length}`, values);
  return json({ data: result.rows });
}
