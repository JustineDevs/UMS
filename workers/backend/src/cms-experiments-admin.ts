import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type Experiment = {
  id: string;
  organization_id: string;
  experiment_key: string;
  name: string;
  variants: Array<Record<string, unknown>>;
  active: boolean;
  updated_at: string;
  starts_at: string | null;
  ends_at: string | null;
  traffic_cap_pct: number | null;
  target_page_slug: string | null;
  target_component_key: string | null;
  impressions: number;
  conversions: number;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function tenant(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function allowed(claims: WorkerAuthClaims, write: boolean): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  const needed = write ? "content:write" : "content:read";
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === needed || (!write && value === "content:write"));
}
function normalize(row: Record<string, unknown>): Experiment {
  const variants = Array.isArray(row.variants) ? row.variants.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)) : [];
  return {
    id: String(row.id ?? ""), organization_id: String(row.organization_id ?? ""), experiment_key: String(row.experiment_key ?? ""),
    name: String(row.name ?? ""), variants, active: Boolean(row.active), updated_at: String(row.updated_at ?? ""),
    starts_at: row.starts_at == null ? null : String(row.starts_at), ends_at: row.ends_at == null ? null : String(row.ends_at),
    traffic_cap_pct: row.traffic_cap_pct == null ? null : Number(row.traffic_cap_pct),
    target_page_slug: row.target_page_slug == null ? null : String(row.target_page_slug),
    target_component_key: row.target_component_key == null ? null : String(row.target_component_key),
    impressions: Math.max(0, Number(row.impressions) || 0), conversions: Math.max(0, Number(row.conversions) || 0),
  };
}
function validId(value: string): boolean { return /^[0-9a-f-]{16,80}$/i.test(value); }
function validKey(value: unknown): value is string { return typeof value === "string" && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value.trim()) && value.trim().length <= 120; }
function validNullableText(value: unknown, max: number): value is string | null { return value == null || (typeof value === "string" && value.length <= max); }
function parseInput(body: unknown): { experimentKey: string; name: string; variants: Array<Record<string, unknown>>; active: boolean; startsAt: string | null; endsAt: string | null; trafficCap: number | null; targetPage: string | null; targetComponent: string | null; impressions: number; conversions: number } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (!validKey(input.experiment_key) || !Array.isArray(input.variants) || input.variants.length < 1 || input.variants.length > 20) return null;
  if (typeof input.name !== "undefined" && (typeof input.name !== "string" || input.name.length > 240)) return null;
  if (typeof input.active !== "undefined" && typeof input.active !== "boolean") return null;
  if (!validNullableText(input.starts_at, 64) || !validNullableText(input.ends_at, 64) || !validNullableText(input.target_page_slug, 160) || !validNullableText(input.target_component_key, 160)) return null;
  if (input.traffic_cap_pct !== undefined && input.traffic_cap_pct !== null && (typeof input.traffic_cap_pct !== "number" || !Number.isFinite(input.traffic_cap_pct) || input.traffic_cap_pct < 0 || input.traffic_cap_pct > 100)) return null;
  const variants = input.variants.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value));
  if (variants.length !== input.variants.length || variants.some((value) => Object.keys(value).length > 20)) return null;
  const counter = (value: unknown): number | null => value === undefined ? 0 : typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  const impressions = counter(input.impressions); const conversions = counter(input.conversions);
  if (impressions === null || conversions === null) return null;
  return { experimentKey: input.experiment_key.trim(), name: typeof input.name === "string" ? input.name.trim() : "", variants, active: input.active ?? false, startsAt: input.starts_at == null ? null : input.starts_at, endsAt: input.ends_at == null ? null : input.ends_at, trafficCap: input.traffic_cap_pct == null ? null : input.traffic_cap_pct, targetPage: input.target_page_slug == null ? null : input.target_page_slug, targetComponent: input.target_component_key == null ? null : input.target_component_key, impressions, conversions };
}
async function digest(value: string): Promise<string> { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
const projection = "id, organization_id, experiment_key, name, variants, active, updated_at, starts_at, ends_at, traffic_cap_pct, target_page_slug, target_component_key, impressions, conversions";

export async function handleAdminCmsExperimentsRequest(request: Request, database: WorkerDatabaseClient, env: Env, experimentId?: string): Promise<Response> {
  if (!["GET", "POST", "PUT"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!allowed(claims, request.method !== "GET")) return json({ error: "forbidden" }, 403);
  if (experimentId && !validId(experimentId)) return json({ error: "invalid_experiment_id" }, 400);
  if (request.method === "GET") {
    const result = await database.query<Record<string, unknown>>(`SELECT ${projection} FROM public.cms_ab_experiments WHERE organization_id = $1 ${experimentId ? "AND id = $2" : ""} ORDER BY experiment_key LIMIT $${experimentId ? 3 : 2}`, experimentId ? [organizationId, experimentId, 500] : [organizationId, 500]);
    return json({ data: experimentId ? (result.rows[0] ? normalize(result.rows[0]) : null) : result.rows.map(normalize) });
  }
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  let body: unknown;
  try { const raw = await request.text(); if (raw.length > 128 * 1024) return json({ error: "payload_too_large" }, 413); body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  const input = parseInput(body);
  if (!input) return json({ error: "invalid_experiment_payload" }, 400);
  const hash = await digest(JSON.stringify({ organizationId, experimentId: experimentId ?? null, input }));
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `cms-experiment:${organizationId}:${experimentId ?? input.experimentKey}:${key}`, hash, async () => {
    const values = [organizationId, input.experimentKey, input.name, JSON.stringify(input.variants), input.active, input.startsAt, input.endsAt, input.trafficCap, input.targetPage, input.targetComponent, input.impressions, input.conversions];
    const result = experimentId
      ? await database.query<Record<string, unknown>>(`UPDATE public.cms_ab_experiments SET experiment_key = $2, name = $3, variants = $4::jsonb, active = $5, starts_at = $6, ends_at = $7, traffic_cap_pct = $8, target_page_slug = $9, target_component_key = $10, impressions = $11, conversions = $12, updated_at = now() WHERE organization_id = $1 AND id = $13 RETURNING ${projection}`, [...values, experimentId])
      : await database.query<Record<string, unknown>>(`INSERT INTO public.cms_ab_experiments (organization_id, experiment_key, name, variants, active, starts_at, ends_at, traffic_cap_pct, target_page_slug, target_component_key, impressions, conversions, updated_at) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,now()) ON CONFLICT (organization_id, experiment_key) DO UPDATE SET name = EXCLUDED.name, variants = EXCLUDED.variants, active = EXCLUDED.active, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, traffic_cap_pct = EXCLUDED.traffic_cap_pct, target_page_slug = EXCLUDED.target_page_slug, target_component_key = EXCLUDED.target_component_key, impressions = EXCLUDED.impressions, conversions = EXCLUDED.conversions, updated_at = now() RETURNING ${projection}`, values);
    const row = result.rows[0];
    if (!row) return json({ error: experimentId ? "experiment_not_found" : "experiment_write_failed" }, experimentId ? 404 : 500);
    const data = normalize(row);
    await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", [experimentId ? "cms.experiment.update" : "cms.experiment.upsert", `cms-experiment:${data.id}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub })]);
    return json({ data });
  })).response;
}
