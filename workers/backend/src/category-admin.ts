import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type CategoryInput = { id?: string; collection_id?: string | null; collection_handle: string; locale?: string; intro_html?: string; banner_url?: string | null; banner_alt?: string | null; blocks?: unknown[] };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function canWrite(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((value) => value === "*" || value === "content:write") || claims.role === "owner" || claims.role === "admin"; }
function safeUrl(value: unknown): string | null { if (value === null || value === undefined) return null; if (typeof value !== "string" || value.length > 2000) return null; try { const parsed = new URL(value, "https://storefront.invalid"); return ["http:", "https:"].includes(parsed.protocol) || value.startsWith("/") ? value : null; } catch { return null; } }
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
async function save(database: WorkerDatabaseClient, organizationId: string, input: CategoryInput): Promise<Response> {
  return withWorkerTransaction(database, async (tx) => {
    const result = await tx.query(`INSERT INTO public.cms_category_content (id, organization_id, collection_id, collection_handle, locale, intro_html, banner_url, banner_alt, blocks, updated_at) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now()) ON CONFLICT (organization_id, collection_handle, locale) DO UPDATE SET collection_id=EXCLUDED.collection_id, intro_html=EXCLUDED.intro_html, banner_url=EXCLUDED.banner_url, banner_alt=EXCLUDED.banner_alt, blocks=EXCLUDED.blocks, updated_at=now() RETURNING *`, [input.id ?? null, organizationId, input.collection_id ?? null, input.collection_handle, input.locale ?? "en", input.intro_html ?? "", input.banner_url ?? null, input.banner_alt ?? null, JSON.stringify(input.blocks ?? [])]);
    return result.rows[0] ? json({ data: result.rows[0] }) : json({ error: "category_write_failed" }, 500);
  });
}
export async function handleCmsAdminCategoryRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "GET") {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? "100");
    const limit = Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 100;
    const result = await database.query(`SELECT * FROM public.cms_category_content WHERE organization_id = $1 ORDER BY collection_handle, locale LIMIT $2`, [organizationId, limit]);
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
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), key, await digest(raw), () => save(database, organizationId, input))).response;
}
