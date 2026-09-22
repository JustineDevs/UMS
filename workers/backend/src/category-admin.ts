import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { lockCmsMediaReferences } from "./cms-media-references.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type CategoryInput = { id?: string; collection_id?: string | null; collection_handle: string; locale?: string; intro_html?: string; banner_url?: string | null; banner_alt?: string | null; blocks?: unknown[] };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function canWrite(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((value) => value === "*" || value === "content:write") || claims.role === "owner" || claims.role === "admin"; }
function canRead(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((value) => value === "*" || value === "content:read" || value === "content:write") || claims.role === "owner" || claims.role === "admin"; }
function safeUrl(value: unknown): string | null { if (value === null || value === undefined) return null; if (typeof value !== "string" || value.length > 2000) return null; try { const parsed = new URL(value, "https://storefront.invalid"); return ["http:", "https:"].includes(parsed.protocol) || value.startsWith("/") ? value : null; } catch { return null; } }
function escapeHtml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
function parse(value: unknown): CategoryInput | null {
  if (!record(value) || typeof value.collection_handle !== "string" || !/^[a-z0-9][a-z0-9/_-]{0,254}$/i.test(value.collection_handle)) return null;
  const locale = value.locale ?? "en";
  if (typeof locale !== "string" || !/^[a-z]{2,12}(?:-[A-Z]{2})?$/.test(locale)) return null;
  if (value.id !== undefined && (typeof value.id !== "string" || value.id.length > 160)) return null;
  if (value.collection_id !== undefined && value.collection_id !== null && (typeof value.collection_id !== "string" || value.collection_id.length > 160)) return null;
  if (value.intro_html !== undefined && (typeof value.intro_html !== "string" || value.intro_html.length > 512 * 1024)) return null;
  if (value.banner_alt !== undefined && value.banner_alt !== null && (typeof value.banner_alt !== "string" || value.banner_alt.length > 500)) return null;
  if (value.blocks !== undefined && (!Array.isArray(value.blocks) || value.blocks.length > 500)) return null;
  const banner = safeUrl(value.banner_url);
  if (value.banner_url !== undefined && value.banner_url !== null && !banner) return null;
  return { id: value.id as string | undefined, collection_id: value.collection_id as string | null | undefined, collection_handle: value.collection_handle, locale, intro_html: value.intro_html as string | undefined, banner_url: banner, banner_alt: value.banner_alt as string | null | undefined, blocks: value.blocks as unknown[] | undefined };
}
async function digest(raw: string): Promise<string> { const value = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)); return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function save(database: WorkerDatabaseClient, organizationId: string, input: CategoryInput, actorSubject: string): Promise<Response> {
  return withWorkerTransaction(database, async (tx) => {
    if (!await lockCmsMediaReferences(tx, organizationId, input)) return json({ error: "media_reference_deleted" }, 409);
    const result = await tx.query(`INSERT INTO public.cms_category_content (id, organization_id, collection_id, collection_handle, locale, intro_html, banner_url, banner_alt, blocks, updated_at) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now()) ON CONFLICT (organization_id, collection_handle, locale) DO UPDATE SET collection_id=EXCLUDED.collection_id, intro_html=EXCLUDED.intro_html, banner_url=EXCLUDED.banner_url, banner_alt=EXCLUDED.banner_alt, blocks=EXCLUDED.blocks, updated_at=now() RETURNING id, organization_id, collection_id, collection_handle, locale, intro_html, banner_url, banner_alt, blocks, updated_at`, [input.id ?? null, organizationId, input.collection_id ?? null, input.collection_handle, input.locale ?? "en", input.intro_html ?? "", input.banner_url ?? null, input.banner_alt ?? null, JSON.stringify(input.blocks ?? [])]);
    if (!result.rows[0]) return json({ error: "category_write_failed" }, 500);
    await tx.query(
      "INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)",
      ["cms.category_content.upsert", `category-content:${input.collection_handle}`, JSON.stringify({ organization_id: organizationId, actor_subject: actorSubject, locale: input.locale ?? "en" })],
    );
    return json({ data: result.rows[0] });
  });
}
export async function handleCmsAdminCategoryRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "GET") {
    if (!canRead(claims)) return json({ error: "forbidden" }, 403);
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? "100");
    const limit = Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 100;
    const result = await database.query(`SELECT id, organization_id, collection_id, collection_handle, locale, intro_html, banner_url, banner_alt, blocks, updated_at FROM public.cms_category_content WHERE organization_id = $1 ORDER BY collection_handle, locale LIMIT $2`, [organizationId, limit]);
    return json({ data: result.rows, limit });
  }
  if (!canWrite(claims)) return json({ error: "forbidden" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text();
  if (raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413);
  let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_category_payload" }, 400); }
  const input = parse(value);
  if (!input) return json({ error: "invalid_category_payload" }, 400);
  const scopedKey = await digest(`cms-category-content:${organizationId}:${key}`);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), scopedKey, await digest(raw), () => save(database, organizationId, input, claims.sub))).response;
}

export async function handleCmsAdminCategoryGapsRequest(
  request: Request,
  appDatabase: WorkerDatabaseClient,
  commerceDatabase: WorkerDatabaseClient,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!canRead(claims)) return json({ error: "forbidden" }, 403);
  const locale = new URL(request.url).searchParams.get("locale")?.trim() || "en";
  if (!/^[a-z]{2,12}(?:-[A-Z]{2})?$/.test(locale)) return json({ error: "invalid_locale" }, 400);
  const [cmsRows, catalog] = await Promise.all([
    appDatabase.query<{ collection_handle: string }>(
      "SELECT collection_handle FROM public.cms_category_content WHERE organization_id = $1 AND locale = $2",
      [organizationId, locale],
    ),
    commerceDatabase.query<{ id: string; name: string; handle: string }>(
      "SELECT id, name, handle FROM public.product_category WHERE deleted_at IS NULL ORDER BY name, id LIMIT 500",
    ),
  ]);
  const existing = new Set(cmsRows.rows.map((row) => row.collection_handle.trim().toLowerCase()).filter(Boolean));
  const categories = catalog.rows.filter((row) => typeof row.handle === "string" && row.handle.trim());
  const missing = categories.filter((row) => !existing.has(row.handle.trim().toLowerCase()));
  return json({ data: { locale, catalog_count: categories.length, cms_rows_for_locale: cmsRows.rows.length, missing } });
}

export async function handleCmsAdminCategorySyncRequest(
  request: Request,
  appDatabase: WorkerDatabaseClient,
  commerceDatabase: WorkerDatabaseClient,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!canWrite(claims)) return json({ error: "forbidden" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  const requestedLocale = new URL(request.url).searchParams.get("locale")?.trim() || "en";
  if (!/^[a-z]{2,12}(?:-[A-Z]{2})?$/.test(requestedLocale)) return json({ error: "invalid_locale" }, 400);
  const requestHash = await digest(JSON.stringify({ organizationId, locale: requestedLocale }));
  const scopedKey = await digest(`cms-category-sync:${organizationId}:${key}`);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(appDatabase), scopedKey, requestHash, async () => {
    const catalog = await commerceDatabase.query<{ id: string; name: string; handle: string }>(
      "SELECT id, name, handle FROM public.product_category WHERE deleted_at IS NULL ORDER BY name, id LIMIT 500",
    );
    let created = 0;
    await withWorkerTransaction(appDatabase, async (transaction) => {
      for (const category of catalog.rows) {
        if (!category.handle || !/^[a-z0-9][a-z0-9/_-]{0,254}$/i.test(category.handle)) continue;
        const result = await transaction.query(
          `INSERT INTO public.cms_category_content
             (id, organization_id, collection_id, collection_handle, locale, intro_html, blocks, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, '[]'::jsonb, now())
           ON CONFLICT (organization_id, collection_handle, locale) DO NOTHING
           RETURNING id`,
          [organizationId, category.id, category.handle, requestedLocale, `<p>${escapeHtml(category.name || category.handle)}</p>`],
        );
        if (result.rowCount === 1) created += 1;
      }
      await transaction.query(
        "INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)",
        ["cms.category_content.sync", "category-content", JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub, locale: requestedLocale, created })],
      );
    });
    return json({ data: { created, locale: requestedLocale, totalCategories: catalog.rows.length } });
  })).response;
}
