import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string; SUPABASE_STORAGE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((value) => value === "*" || value === "content:read" || value === "catalog:read" || value === "catalog:write") || claims.role === "owner" || claims.role === "admin"; }
function safeLimit(value: string | null): number { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200; }
function safeSort(value: string | null): "created_at ASC" | "display_name ASC" | "display_name DESC" | "created_at DESC" { return value === "created_asc" ? "created_at ASC" : value === "name_asc" ? "display_name ASC" : value === "name_desc" ? "display_name DESC" : "created_at DESC"; }

function safeSegment(value: string): string { return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload"; }

async function uploadDigest(parts: Array<string | Uint8Array>): Promise<string> {
  const encoded = parts.map((part) => typeof part === "string" ? new TextEncoder().encode(part) : part);
  const total = encoded.reduce((sum, part) => sum + part.byteLength, 0);
  const data = new Uint8Array(total);
  let offset = 0;
  for (const part of encoded) {
    data.set(part, offset);
    offset += part.byteLength;
  }
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function scopedMediaIdempotencyKey(
  organizationId: string,
  actorId: string,
  operation: string,
  requestKey: string,
): Promise<string> {
  return `cms-media:v1:${await uploadDigest([JSON.stringify([organizationId, actorId, operation, requestKey])])}`;
}

function requestIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("Idempotency-Key")?.trim();
  return key && key.length <= 255 ? key : null;
}

type MediaRow = {
  id: string;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  deleted_at: string | null;
  display_name: string | null;
  byte_size: number | null;
  tags: string[];
  organization_id: string;
  storage_cleanup_status?: "ready" | "pending" | "processing" | "retry" | "complete" | "external";
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
        { text: "SELECT id, to_jsonb(cms_navigation_draft) AS payload FROM public.cms_navigation_draft WHERE organization_id = $2 AND to_jsonb(cms_navigation_draft)::text LIKE $1 LIMIT 100", source: "cms_navigation_draft" },
        { text: "SELECT component_key, id, to_jsonb(cms_component_definitions) AS payload FROM public.cms_component_definitions WHERE organization_id = $2 AND to_jsonb(cms_component_definitions)::text LIKE $1 LIMIT 500", source: "cms_component_definitions" },
        { text: "SELECT id, to_jsonb(storefront_home_content) AS payload FROM public.storefront_home_content WHERE organization_id = $2 AND to_jsonb(storefront_home_content)::text LIKE $1 LIMIT 100", source: "storefront_home_content" },
      ];
  for (const query of queries) {
    const result = await database.query<Record<string, unknown>>(query.text, medusa ? [`%${needle}%`] : [`%${needle}%`, organizationId]);
    for (const row of result.rows) {
      const detail = medusa
        ? `${String(row.title ?? row.handle ?? row.id ?? "product")} (${String(row.id ?? "")})`
        : `${String(row.slug ?? row.collection_handle ?? row.component_key ?? row.id ?? "default")} (${String(row.locale ?? "")})`;
      hits.push({ source: query.source, detail });
    }
  }
  return hits;
}

async function mediaById(database: WorkerDatabaseClient, id: string, organizationId: string, includeDeleted = false, lock = false): Promise<MediaRow | null> {
  const result = await database.query<MediaRow>(
    `SELECT id, storage_path, public_url, alt_text, mime_type, width, height, created_at, deleted_at, display_name, byte_size, tags, organization_id, storage_cleanup_status FROM public.cms_media WHERE id = $1 AND organization_id = $2${includeDeleted ? "" : " AND deleted_at IS NULL"} LIMIT 1${lock ? " FOR UPDATE" : ""}`,
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
  const requestKey = requestIdempotencyKey(request);
  if (!requestKey) return json({ error: "idempotency_key_required" }, 400);
  const idempotencyKey = await scopedMediaIdempotencyKey(organizationId, claims.sub, `delete:${mediaId}`, requestKey);
  const requestHash = await uploadDigest([organizationId, claims.sub, "delete", mediaId]);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(appDatabase),
    idempotencyKey,
    requestHash,
    async () => {
      return withWorkerTransaction(appDatabase, async (tx) => {
        // Serialize against catalog writes that lock the same APP media rows
        // until their MEDUSA transaction commits.
        const row = await mediaById(tx, mediaId, organizationId, true, true);
        if (!row) return json({ error: "not_found" }, 404);
        if (row.deleted_at) {
          const queued = row.storage_cleanup_status === "pending" || row.storage_cleanup_status === "retry" || row.storage_cleanup_status === "processing";
          return json({ ok: true, storageCleanup: queued ? "queued" : "complete" }, queued ? 202 : 200);
        }
        const isCatalog = row.tags.includes("catalog-product");
        if (!(claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "content:write" || (isCatalog && value === "catalog:write")))) return json({ error: "forbidden" }, 403);
        const [cmsReferences, medusaReferences] = await Promise.all([
          findMediaReferences(tx, row.public_url, organizationId, false),
          findMediaReferences(medusaDatabase, row.public_url, organizationId, true),
        ]);
        const references = [...cmsReferences, ...medusaReferences];
        if (references.length > 0) return json({ error: "media_in_use", references }, 409);
        const external = row.storage_path.startsWith("external/");
        const result = await tx.query(
          `UPDATE public.cms_media SET deleted_at = now(), storage_cleanup_status = $3, storage_cleanup_attempts = 0, storage_cleanup_next_attempt_at = CASE WHEN $3 = 'pending' THEN now() ELSE NULL END, storage_cleanup_last_error = NULL WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL RETURNING id`,
          [mediaId, organizationId, external ? "external" : "pending"],
        );
        if (!result.rowCount) return json({ error: "delete_conflict" }, 409);
        await tx.query(
          "INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)",
          ["cms.media.delete", `media:${mediaId}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub, storage_cleanup: external ? "external" : "queued" })],
        );
        return json({ ok: true, storageCleanup: external ? "external" : "queued" }, external ? 200 : 202);
      });
    },
  );
  return result.response;
}

export async function handleCmsAdminMediaUploadRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  const isCmsUpload = new URL(request.url).pathname.replace(/\/$/, "").endsWith("/cms/media");
  const canContentWrite = claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "content:write");
  const canCatalogWrite = claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "catalog:write");
  if (!(isCmsUpload ? canContentWrite || canCatalogWrite : canCatalogWrite)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  const requestLimit = isCmsUpload ? 25 * 1024 * 1024 + 256 * 1024 : 100 * 1024 * 1024 + 256 * 1024;
  if (Number.isFinite(declaredLength) && declaredLength > requestLimit) return json({ error: "payload_too_large" }, 413);
  const requestKey = requestIdempotencyKey(request);
  if (!requestKey) return json({ error: "idempotency_key_required" }, 400);
  const storageUrl = env.SUPABASE_STORAGE_URL ?? env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!storageUrl || !serviceKey) return json({ error: "storage_not_configured" }, 503);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "invalid_form_data" }, 400); }
  const file = form.get("file");
  const bucket = isCmsUpload ? "cms" : "catalog";
  if (!(file instanceof File) || file.size < 1) return json({ error: "invalid_file_size" }, 400);
  const declaredMime = file.type.trim().toLowerCase();
  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";
  const extensionMime: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    gif: "image/gif", avif: "image/avif", svg: "image/svg+xml", bmp: "image/bmp",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", ogg: "video/ogg",
  };
  const mime = !declaredMime || declaredMime === "application/octet-stream" ? extensionMime[extension] ?? "" : declaredMime;
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml", "image/bmp", "video/mp4", "video/webm", "video/quicktime", "video/ogg"]);
  if (!allowed.has(mime)) return json({ error: "unsupported_media_type" }, 400);
  const isVideo = mime.startsWith("video/");
  const maxBytes = isCmsUpload ? 25 * 1024 * 1024 : isVideo ? 100 * 1024 * 1024 : 25 * 1024 * 1024;
  if (file.size > maxBytes) return json({ error: "invalid_file_size" }, 400);
  const safeName = safeSegment(file.name);
  const productId = !isCmsUpload && typeof form.get("productId") === "string" ? safeSegment(form.get("productId") as string) : "";
  const rawAlt = form.get("alt");
  const suppliedAlt = typeof rawAlt === "string" ? rawAlt.trim().slice(0, 500) : "";
  if (isCmsUpload && mime.startsWith("image/") && !suppliedAlt) return json({ error: "alt_text_required" }, 400);
  const altText = mime.startsWith("image/") ? suppliedAlt || `Product image: ${safeName.replace(/\.[^.]+$/, "")}` : null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const requestHash = await uploadDigest([
    organizationId,
    claims.sub,
    bucket,
    productId,
    safeName,
    mime,
    altText ?? "",
    bytes,
  ]);
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(database),
    await scopedMediaIdempotencyKey(organizationId, claims.sub, `upload:${bucket}`, requestKey),
    requestHash,
    async () => {
      const path = `${productId ? `products/${productId}` : "public"}/${crypto.randomUUID()}-${safeName}`;
      const storage = await fetch(`${storageUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path}`, { method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": mime, "x-upsert": "false" }, body: bytes });
      if (!storage.ok) return json({ error: "media_upload_failed" }, 502);
      const publicUrl = `${storageUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
      const tags = isCmsUpload ? [] : ["catalog-product"];
      let inserted: { rows: Array<Record<string, unknown>> };
      try {
        inserted = await withWorkerTransaction(database, async (tx) => {
          const result = await tx.query(`INSERT INTO public.cms_media (organization_id,storage_path,public_url,alt_text,mime_type,display_name,byte_size,tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[]) RETURNING id,storage_path,public_url,alt_text,mime_type,width,height,created_at,deleted_at,display_name,byte_size,tags,organization_id`, [organizationId, path, publicUrl, altText, mime, safeName, file.size, tags]);
          const row = result.rows[0];
          if (!row) throw new Error("media_metadata_failed");
          await tx.query(
            "INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)",
            ["cms.media.upload", `media:${String(row.id)}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub, bucket, mime_type: mime, byte_size: file.size })],
          );
          return result;
        });
      } catch {
        await fetch(`${storageUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }).catch(() => undefined);
        return json({ error: "media_metadata_failed" }, 502);
      }
      if (!inserted.rows[0]) { await fetch(`${storageUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }).catch(() => undefined); return json({ error: "media_metadata_failed" }, 502); }
      return json({ data: inserted.rows[0] }, 201);
    },
  );
  return result.response;
}
export async function handleCmsAdminMediaListRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const params = new URL(request.url).searchParams;
  const catalogEndpoint = new URL(request.url).pathname.replace(/\/$/, "").endsWith("/catalog/media");
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  const contentReader = claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "content:read");
  const requestedTag = params.get("tag")?.trim();
  if (!contentReader && requestedTag && requestedTag !== "catalog-product") return json({ data: [] });
  const values: unknown[] = [organizationId];
  const clauses = ["organization_id = $1", "deleted_at IS NULL"];
  if (params.get("q")?.trim()) { values.push(`%${params.get("q")!.trim()}%`); clauses.push(`(public_url ILIKE $${values.length} OR display_name ILIKE $${values.length} OR alt_text ILIKE $${values.length})`); }
  if (params.get("mime")?.trim()) { values.push(`${params.get("mime")!.trim()}%`); clauses.push(`mime_type ILIKE $${values.length}`); }
  const effectiveTag = catalogEndpoint ? "catalog-product" : contentReader ? requestedTag : "catalog-product";
  if (effectiveTag) { values.push(effectiveTag); clauses.push(`$${values.length} = ANY(tags)`); }
  values.push(safeLimit(params.get("limit")));
  const result = await database.query(`SELECT id, storage_path, public_url, alt_text, mime_type, width, height, created_at, deleted_at, display_name, byte_size, tags, organization_id FROM public.cms_media WHERE ${clauses.join(" AND ")} ORDER BY ${safeSort(params.get("sort"))} LIMIT $${values.length}`, values);
  return json({ data: result.rows });
}

export async function handleCmsAdminMediaDetailRequest(request: Request, appDatabase: WorkerDatabaseClient, medusaDatabase: WorkerDatabaseClient, env: Env, mediaId: string): Promise<Response> {
  if (!["GET", "PATCH"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(mediaId)) return json({ error: "invalid_media_id" }, 400);
  const row = await mediaById(appDatabase, mediaId, organizationId);
  if (!row) return json({ error: "not_found" }, 404);
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  const isPrivileged = claims.role === "owner" || claims.role === "admin" || permissions.includes("*");
  const isCatalog = row.tags.includes("catalog-product");
  const contentRead = isPrivileged || permissions.includes("content:read");
  const catalogRead = isPrivileged || permissions.includes("catalog:read") || permissions.includes("catalog:write");
  const contentWrite = isPrivileged || permissions.includes("content:write");
  const catalogWrite = isPrivileged || permissions.includes("catalog:write");
  if (request.method === "GET") {
    if (!contentRead && !(isCatalog && catalogRead)) return json({ error: "forbidden" }, 403);
    if (new URL(request.url).searchParams.get("refs") === "1") {
      const [cmsReferences, commerceReferences] = await Promise.all([
        findMediaReferences(appDatabase, row.public_url, organizationId, false),
        isCatalog ? findMediaReferences(medusaDatabase, row.public_url, organizationId, true) : Promise.resolve([]),
      ]);
      return json({ data: { row, refs: [...cmsReferences, ...commerceReferences] } });
    }
    return json({ data: row });
  }
  if (!contentWrite && !(isCatalog && catalogWrite)) return json({ error: "forbidden" }, 403);
  const requestKey = requestIdempotencyKey(request);
  if (!requestKey) return json({ error: "idempotency_key_required" }, 400);
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 64 * 1024) return json({ error: "payload_too_large" }, 413);
  let input: unknown;
  try { input = JSON.parse(body); } catch { return json({ error: "invalid_media_metadata" }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "invalid_media_metadata" }, 400);
  const data = input as Record<string, unknown>;
  const allowed = new Set(["alt_text", "display_name", "tags"]);
  if (Object.keys(data).some((key) => !allowed.has(key))) return json({ error: "invalid_media_metadata" }, 400);
  if (data.alt_text !== undefined && data.alt_text !== null && (typeof data.alt_text !== "string" || data.alt_text.length > 500)) return json({ error: "invalid_media_metadata" }, 400);
  if (data.display_name !== undefined && data.display_name !== null && (typeof data.display_name !== "string" || data.display_name.length > 160)) return json({ error: "invalid_media_metadata" }, 400);
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.length > 50 || data.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 80))) return json({ error: "invalid_media_metadata" }, 400);
  let tags = data.tags === undefined ? undefined : [...new Set((data.tags as string[]).map((tag) => tag.trim()))];
  if (tags !== undefined && tags.includes("catalog-product") !== isCatalog) return json({ error: "media_bucket_tag_immutable" }, 400);
  if (isCatalog && tags !== undefined) tags = [...new Set([...tags, "catalog-product"])];
  const result = await executeIdempotently(
    new HyperdriveIdempotencyStore(appDatabase),
    await scopedMediaIdempotencyKey(organizationId, claims.sub, `update:${mediaId}`, requestKey),
    await uploadDigest([organizationId, claims.sub, "update", mediaId, body]),
    async () => {
      const updated = await withWorkerTransaction(appDatabase, async (tx) => {
        const result = await tx.query<MediaRow>(
          `UPDATE public.cms_media SET alt_text = CASE WHEN $3::boolean THEN $4 ELSE alt_text END, display_name = CASE WHEN $5::boolean THEN $6 ELSE display_name END, tags = CASE WHEN $7::boolean THEN $8::text[] ELSE tags END WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL RETURNING id, storage_path, public_url, alt_text, mime_type, width, height, created_at, deleted_at, display_name, byte_size, tags, organization_id`,
          [mediaId, organizationId, data.alt_text !== undefined, data.alt_text ?? null, data.display_name !== undefined, data.display_name ?? null, tags !== undefined, tags ?? []],
        );
        const row = result.rows[0];
        if (!row) return null;
        await tx.query(
          "INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)",
          ["cms.media.update", `media:${mediaId}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub, changed_fields: Object.keys(data) })],
        );
        return row;
      });
      if (!updated) return json({ error: "media_update_failed" }, 500);
      return json({ data: updated });
    },
  );
  return result.response;
}
