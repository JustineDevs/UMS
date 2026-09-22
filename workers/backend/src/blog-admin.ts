import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { lockCmsMediaReferences } from "./cms-media-references.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type BlogInput = { id?: string; slug: string; locale?: string; title: string; excerpt?: string; body: string; cover_image_url?: string | null; author_name?: string | null; tags?: string[]; status?: "draft" | "published" | "scheduled"; published_at?: string | null; scheduled_publish_at?: string | null; meta_title?: string | null; meta_description?: string | null; og_image_url?: string | null; json_ld?: unknown | null };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function org(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function canWrite(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((item) => item === "*" || item === "content:write") || claims.role === "owner" || claims.role === "admin"; }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((item) => item === "*" || item === "content:read" || item === "content:write") || claims.role === "owner" || claims.role === "admin"; }
function safeUrl(value: unknown): string | null { if (value === null || value === undefined) return null; if (typeof value !== "string" || value.length > 2000) return null; try { const parsed = new URL(value, "https://storefront.invalid"); return ["http:", "https:"].includes(parsed.protocol) || value.startsWith("/") ? value : null; } catch { return null; } }
function parse(value: unknown): BlogInput | null {
  if (!record(value) || typeof value.slug !== "string" || !/^[a-z0-9][a-z0-9/_-]{0,159}$/i.test(value.slug) || typeof value.title !== "string" || value.title.length > 300 || !value.title.trim() || typeof value.body !== "string" || value.body.length > 512 * 1024) return null;
  const locale = value.locale ?? "en"; if (typeof locale !== "string" || !/^[a-z]{2,12}(?:-[A-Z]{2})?$/.test(locale)) return null;
  if (value.id !== undefined && (typeof value.id !== "string" || value.id.length > 160)) return null;
  if (value.status !== undefined && !["draft", "published", "scheduled"].includes(String(value.status))) return null;
  if (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.length > 50 || value.tags.some((tag) => typeof tag !== "string" || tag.length > 80))) return null;
  for (const field of ["excerpt", "author_name", "meta_title", "meta_description"] as const) if (value[field] !== undefined && value[field] !== null && (typeof value[field] !== "string" || value[field].length > 5000)) return null;
  for (const field of ["published_at", "scheduled_publish_at"] as const) if (value[field] !== undefined && value[field] !== null && (typeof value[field] !== "string" || Number.isNaN(Date.parse(value[field] as string)))) return null;
  const cover = safeUrl(value.cover_image_url); const og = safeUrl(value.og_image_url); if ((value.cover_image_url !== undefined && value.cover_image_url !== null && !cover) || (value.og_image_url !== undefined && value.og_image_url !== null && !og)) return null;
  return { id: value.id as string | undefined, slug: value.slug, locale, title: value.title, excerpt: value.excerpt as string | undefined, body: value.body, cover_image_url: cover, author_name: value.author_name as string | null | undefined, tags: value.tags as string[] | undefined, status: value.status as BlogInput["status"], published_at: value.published_at as string | null | undefined, scheduled_publish_at: value.scheduled_publish_at as string | null | undefined, meta_title: value.meta_title as string | null | undefined, meta_description: value.meta_description as string | null | undefined, og_image_url: og, json_ld: value.json_ld as unknown | null | undefined };
}
async function hash(raw: string): Promise<string> { const value = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)); return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function outputRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id ?? ""), slug: String(row.slug ?? ""), locale: String(row.locale ?? "en"), title: String(row.title ?? ""),
    excerpt: String(row.excerpt ?? ""), body: String(row.body ?? ""), cover_image_url: row.cover_image_url == null ? null : String(row.cover_image_url),
    author_name: row.author_name == null ? null : String(row.author_name), tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 50) : [],
    status: ["draft", "published", "scheduled"].includes(String(row.status)) ? String(row.status) : "draft",
    published_at: row.published_at == null ? null : String(row.published_at), scheduled_publish_at: row.scheduled_publish_at == null ? null : String(row.scheduled_publish_at),
    preview_token: row.preview_token == null ? null : String(row.preview_token), meta_title: row.meta_title == null ? null : String(row.meta_title),
    meta_description: row.meta_description == null ? null : String(row.meta_description), canonical_url: row.canonical_url == null ? null : String(row.canonical_url),
    og_image_url: row.og_image_url == null ? null : String(row.og_image_url), rss_include: Boolean(row.rss_include), json_ld: row.json_ld ?? null,
    created_at: String(row.created_at ?? ""), updated_at: String(row.updated_at ?? ""),
  };
}
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
const exportColumns = ["id", "slug", "locale", "title", "status", "published_at", "scheduled_publish_at", "author_name", "tags", "rss_include", "canonical_url", "og_image_url", "updated_at"] as const;

export async function handleCmsAdminBlogExportRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const tenant = org(claims); if (!tenant) return json({ error: "organization_claim_required" }, 403);
  const rawIds = new URL(request.url).searchParams.get("ids");
  const ids = rawIds?.split(",").map((value) => value.trim()).filter(Boolean);
  if (ids && (ids.length > 100 || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id)))) return json({ error: "invalid_ids" }, 400);
  const values: unknown[] = [tenant];
  const filters = ["organization_id = $1"];
  if (ids?.length) { values.push(ids); filters.push(`id = ANY($${values.length}::uuid[])`); }
  const result = await database.query<Record<string, unknown>>(
    `SELECT id, slug, locale, title, status, published_at, scheduled_publish_at, author_name, tags, rss_include, canonical_url, og_image_url, updated_at FROM public.cms_blog_posts WHERE ${filters.join(" AND ")} ORDER BY updated_at DESC LIMIT 1000`,
    values,
  );
  const lines = [exportColumns.join(","), ...result.rows.map((row) => exportColumns.map((column) => {
    if (column === "tags") return csvEscape(Array.isArray(row.tags) ? row.tags.map(String).join(";") : "");
    if (column === "rss_include") return row.rss_include === true ? "1" : "0";
    return csvEscape(row[column] == null ? "" : String(row[column]));
  }).join(","))];
  const body = lines.join("\r\n");
  if (new TextEncoder().encode(body).byteLength > 5 * 1024 * 1024) return json({ error: "export_too_large" }, 413);
  await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", [
    "cms.blog.export", "cms_blog_posts", JSON.stringify({ organization_id: tenant, actor_id: claims.sub ?? null, count: result.rows.length, correlation_id: request.headers.get("x-correlation-id") }),
  ]);
  return new Response(body, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="blog-posts.csv"', "Cache-Control": "no-store" } });
}
async function save(database: WorkerDatabaseClient, tenant: string, input: BlogInput): Promise<Response> {
  return withWorkerTransaction(database, async (tx) => {
    if (!await lockCmsMediaReferences(tx, tenant, input)) return json({ error: "media_reference_deleted" }, 409);
    const result = await tx.query(`INSERT INTO public.cms_blog_posts (id, organization_id, slug, locale, title, excerpt, body, cover_image_url, author_name, tags, status, published_at, scheduled_publish_at, meta_title, meta_description, og_image_url, json_ld, updated_at) VALUES (COALESCE($1::uuid, gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,now()) ON CONFLICT (organization_id, slug, locale) DO UPDATE SET title=EXCLUDED.title, excerpt=EXCLUDED.excerpt, body=EXCLUDED.body, cover_image_url=EXCLUDED.cover_image_url, author_name=EXCLUDED.author_name, tags=EXCLUDED.tags, status=EXCLUDED.status, published_at=EXCLUDED.published_at, scheduled_publish_at=EXCLUDED.scheduled_publish_at, meta_title=EXCLUDED.meta_title, meta_description=EXCLUDED.meta_description, og_image_url=EXCLUDED.og_image_url, json_ld=EXCLUDED.json_ld, updated_at=now() RETURNING *`, [input.id ?? null, tenant, input.slug, input.locale ?? "en", input.title, input.excerpt ?? "", input.body, input.cover_image_url ?? null, input.author_name ?? null, input.tags ?? [], input.status ?? "draft", input.published_at ?? null, input.scheduled_publish_at ?? null, input.meta_title ?? null, input.meta_description ?? null, input.og_image_url ?? null, JSON.stringify(input.json_ld ?? null)]);
    return result.rows[0] ? json({ data: outputRow(result.rows[0]) }) : json({ error: "blog_write_failed" }, 500);
  });
}
export async function handleCmsAdminBlogBulkRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canWrite(claims)) return json({ error: "forbidden" }, 403);
  const tenant = org(claims); if (!tenant) return json({ error: "organization_claim_required" }, 403);
  const raw = await request.text();
  if (raw.length > 32 * 1024) return json({ error: "payload_too_large" }, 413);
  let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_blog_bulk_payload" }, 400); }
  if (!record(value) || !Array.isArray(value.ids) || value.ids.length < 1 || value.ids.length > 200 || value.ids.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) return json({ error: "invalid_blog_bulk_payload" }, 400);
  const ids = [...new Set(value.ids as string[])];
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
  const result = await executeIdempotently(new HyperdriveIdempotencyStore(database), key, await hash(`${tenant}:${ids.join(",")}`), () => withWorkerTransaction(database, async (tx) => {
    const deleted = await tx.query("DELETE FROM public.cms_blog_posts WHERE organization_id = $1 AND id = ANY($2::uuid[])", [tenant, ids]);
    await tx.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["cms.blog.bulk_delete", "cms_blog_posts", JSON.stringify({ organization_id: tenant, count: deleted.rowCount ?? 0 })]);
    return json({ ok: true, deleted: deleted.rowCount ?? 0 });
  }));
  return result.response;
}

export async function handleCmsAdminBlogRequest(request: Request, database: WorkerDatabaseClient, env: Env, blogId?: string): Promise<Response> {
  if (!["GET", "POST", "PUT", "DELETE"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL }); if (!claims) return json({ error: "unauthorized" }, 401); const tenant = org(claims); if (!tenant) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "GET") {
    if (!canRead(claims)) return json({ error: "forbidden" }, 403);
    const values: unknown[] = [tenant];
    const filters = ["organization_id = $1"];
    if (blogId) { values.push(blogId); filters.push(`id = $${values.length}`); }
    const result = await database.query(`SELECT id, slug, locale, title, excerpt, body, cover_image_url, author_name, tags, status, published_at, scheduled_publish_at, preview_token, meta_title, meta_description, canonical_url, og_image_url, rss_include, json_ld, created_at, updated_at FROM public.cms_blog_posts WHERE ${filters.join(" AND ")} ORDER BY updated_at DESC LIMIT 500`, values);
    if (blogId && !result.rows.length) return json({ error: "not_found" }, 404);
    return blogId ? json({ data: outputRow(result.rows[0]) }) : json({ data: result.rows.map(outputRow) });
  }
  if (!canWrite(claims)) return json({ error: "forbidden" }, 403);
  if (request.method === "DELETE") {
    if (!blogId) return json({ error: "blog_id_required" }, 400);
    const key = request.headers.get("Idempotency-Key")?.trim();
    if (!key) return json({ error: "idempotency_key_required" }, 400);
    const result = await executeIdempotently(
      new HyperdriveIdempotencyStore(database),
      key,
      await hash(`${tenant}:${blogId}`),
      () => withWorkerTransaction(database, async (tx) => {
        const deleted = await tx.query(
          `DELETE FROM public.cms_blog_posts WHERE organization_id = $1 AND id = $2`,
          [tenant, blogId],
        );
        return json({ ok: true, deleted: deleted.rowCount === 1 });
      }),
    );
    return result.response;
  }
  const raw = await request.text(); if (raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413); let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_blog_payload" }, 400); } const input = parse(value); if (!input || blogId && input.id && input.id !== blogId) return json({ error: "invalid_blog_payload" }, 400); const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400); return (await executeIdempotently(new HyperdriveIdempotencyStore(database), key, await hash(raw), () => save(database, tenant, blogId ? { ...input, id: blogId } : input))).response;
}
