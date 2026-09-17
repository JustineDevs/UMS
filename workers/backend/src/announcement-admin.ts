import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type Input = {
  id?: string; locale?: string; body: string; body_format?: "plain" | "html";
  link_url?: string | null; link_label?: string | null; dismissible?: boolean;
  starts_at?: string | null; ends_at?: string | null; priority?: number;
  stack_group?: string | null; region_code?: string | null;
};
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function organization(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function allowed(claims: WorkerAuthClaims): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return permissions.some((item) => item === "*" || item === "content:write") || claims.role === "owner" || claims.role === "admin"; }
function url(value: unknown): string | null { if (value === null || value === undefined) return null; if (typeof value !== "string" || value.length > 2000) return null; try { const parsed = new URL(value, "https://storefront.invalid"); return parsed.protocol === "http:" || parsed.protocol === "https:" || value.startsWith("/") ? value : null; } catch { return null; } }
function parse(value: unknown): Input | null {
  if (!record(value) || typeof value.body !== "string" || value.body.length > 20_000 || !value.body.trim()) return null;
  const locale = value.locale ?? "en";
  if (typeof locale !== "string" || !/^[a-z]{2,12}(?:-[A-Z]{2})?$/.test(locale)) return null;
  if (value.id !== undefined && (typeof value.id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value.id))) return null;
  if (value.body_format !== undefined && value.body_format !== "plain" && value.body_format !== "html") return null;
  if (value.dismissible !== undefined && typeof value.dismissible !== "boolean") return null;
  if (value.priority !== undefined && (typeof value.priority !== "number" || !Number.isSafeInteger(value.priority) || value.priority < -100_000 || value.priority > 100_000)) return null;
  const linkUrl = url(value.link_url);
  if (value.link_url !== undefined && value.link_url !== null && !linkUrl) return null;
  for (const field of ["link_label", "stack_group", "region_code"] as const) if (value[field] !== undefined && value[field] !== null && (typeof value[field] !== "string" || value[field].length > 200)) return null;
  for (const field of ["starts_at", "ends_at"] as const) if (value[field] !== undefined && value[field] !== null && (typeof value[field] !== "string" || Number.isNaN(Date.parse(value[field] as string)))) return null;
  if (typeof value.starts_at === "string" && typeof value.ends_at === "string" && Date.parse(value.starts_at) > Date.parse(value.ends_at)) return null;
  return { id: value.id as string | undefined, locale, body: value.body, body_format: value.body_format as Input["body_format"], link_url: linkUrl, link_label: value.link_label as string | null | undefined, dismissible: value.dismissible as boolean | undefined, starts_at: value.starts_at as string | null | undefined, ends_at: value.ends_at as string | null | undefined, priority: value.priority as number | undefined, stack_group: value.stack_group as string | null | undefined, region_code: value.region_code as string | null | undefined };
}
async function hash(raw: string): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); }

async function save(database: WorkerDatabaseClient, org: string, input: Input): Promise<Response> {
  const id = input.id ?? "default";
  return withWorkerTransaction(database, async (tx) => {
    const result = await tx.query(`INSERT INTO public.cms_announcement (id, organization_id, locale, body, body_format, link_url, link_label, dismissible, starts_at, ends_at, priority, stack_group, region_code, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()) ON CONFLICT (organization_id, id, locale) DO UPDATE SET body=EXCLUDED.body, body_format=EXCLUDED.body_format, link_url=EXCLUDED.link_url, link_label=EXCLUDED.link_label, dismissible=EXCLUDED.dismissible, starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, priority=EXCLUDED.priority, stack_group=EXCLUDED.stack_group, region_code=EXCLUDED.region_code, updated_at=now() RETURNING *`, [id, org, input.locale ?? "en", input.body, input.body_format ?? "plain", input.link_url ?? null, input.link_label ?? null, input.dismissible ?? true, input.starts_at ?? null, input.ends_at ?? null, input.priority ?? 0, input.stack_group ?? null, input.region_code ?? null]);
    return result.rows[0] ? json({ data: result.rows[0] }) : json({ error: "announcement_write_failed" }, 500);
  });
}
export async function handleCmsAdminAnnouncementRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (!["GET", "PUT", "DELETE"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!allowed(claims)) return json({ error: "forbidden" }, 403);
  const org = organization(claims); if (!org) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "GET") {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? "100");
    const limit = Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 100;
    const result = await database.query(`SELECT * FROM public.cms_announcement WHERE organization_id = $1 ORDER BY priority DESC, updated_at DESC LIMIT $2`, [org, limit]);
    return json({ data: result.rows, limit });
  }
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    const locale = url.searchParams.get("locale")?.trim() || "en";
    if (!id || !/^[A-Za-z0-9_-]{1,160}$/.test(id) || !/^[a-z]{2,12}(?:-[A-Z]{2})?$/.test(locale)) return json({ error: "invalid_announcement_identity" }, 400);
    const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
    const raw = `${org}:${id}:${locale}`;
    return (await executeIdempotently(new HyperdriveIdempotencyStore(database), key, await hash(raw), async () => {
      return withWorkerTransaction(database, async (tx) => {
        const result = await tx.query(`DELETE FROM public.cms_announcement WHERE organization_id = $1 AND id = $2 AND locale = $3`, [org, id, locale]);
        return json({ ok: true, deleted: result.rowCount === 1 });
      });
    })).response;
  }
  const raw = await request.text(); if (raw.length > 128 * 1024) return json({ error: "payload_too_large" }, 413);
  let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_announcement_payload" }, 400); }
  const input = parse(value); if (!input) return json({ error: "invalid_announcement_payload" }, 400);
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key) return json({ error: "idempotency_key_required" }, 400);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), key, await hash(raw), () => save(database, org, input))).response;
}
