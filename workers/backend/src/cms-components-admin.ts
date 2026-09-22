import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { lockCmsMediaReferences } from "./cms-media-references.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type Definition = Record<string, unknown>;
type Row = { id: string; organization_id: string; component_key: string; definition: Definition; version: number; status: "draft" | "published" | "archived"; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function tenant(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function allowed(claims: WorkerAuthClaims, write: boolean): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; const needed = write ? "content:write" : "content:read"; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === needed || (!write && value === "content:write")); }
function normalize(row: Record<string, unknown>): Row { return { id: String(row.id ?? ""), organization_id: String(row.organization_id ?? ""), component_key: String(row.component_key ?? ""), definition: row.definition && typeof row.definition === "object" && !Array.isArray(row.definition) ? row.definition as Definition : {}, version: Number(row.version) || 1, status: row.status === "published" || row.status === "archived" ? row.status : "draft", created_by: row.created_by == null ? null : String(row.created_by), updated_by: row.updated_by == null ? null : String(row.updated_by), created_at: String(row.created_at ?? ""), updated_at: String(row.updated_at ?? "") }; }
function validKey(value: unknown): value is string { return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100; }
function validDefinition(value: unknown): value is Definition { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const definition = value as Record<string, unknown>; return validKey(definition.id) && typeof definition.name === "string" && definition.name.length > 0 && definition.name.length <= 160 && typeof definition.description === "string" && definition.description.length <= 1000 && typeof definition.category === "string" && definition.category.length > 0 && definition.category.length <= 80 && typeof definition.structure === "string" && definition.structure.length > 0 && definition.structure.length <= 1000 && Array.isArray(definition.props) && definition.props.length <= 100 && Array.isArray(definition.slots) && definition.slots.length <= 50 && Array.isArray(definition.variants) && definition.variants.length > 0 && definition.variants.length <= 50 && !(typeof definition.markup === "string" && /<\s*script\b|javascript\s*:/i.test(definition.markup)) && !(typeof definition.styles === "string" && /<\s*\/style\s*>|@import\b|expression\s*\(/i.test(definition.styles)); }
const projection = "id, organization_id, component_key, definition, version, status, created_by, updated_by, created_at, updated_at";
async function digest(value: string): Promise<string> { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
export async function handleAdminCmsComponentsRequest(request: Request, database: WorkerDatabaseClient, env: Env, componentKey?: string): Promise<Response> {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!allowed(claims, request.method !== "GET")) return json({ error: "forbidden" }, 403);
  if (componentKey && !validKey(componentKey)) return json({ error: "invalid_component_id" }, 400);
  if (request.method === "GET") {
    const result = await database.query<Record<string, unknown>>(`SELECT ${projection} FROM public.cms_component_definitions WHERE organization_id = $1 ${componentKey ? "AND component_key = $2" : "AND status <> 'archived'"} ORDER BY component_key LIMIT $${componentKey ? 3 : 2}`, componentKey ? [organizationId, componentKey, 500] : [organizationId, 500]);
    if (componentKey) return json({ data: result.rows[0] ? normalize(result.rows[0]) : null });
    const stored = result.rows.map(normalize);
    const data = stored.map((row) => row.definition);
    const records = stored.map((row) => ({ id: row.component_key, version: row.version, status: row.status }));
    return json({ data, meta: { version: Math.max(1, ...stored.map((row) => row.version)), contract: "cms-component-editor-v2", source: "organization", records } });
  }
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  let body: unknown; try { const raw = await request.text(); if (raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413); body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  const actor = typeof claims.email === "string" ? claims.email : claims.sub;
  if (request.method === "DELETE") {
    const version = Number(new URL(request.url).searchParams.get("version")); if (!componentKey || !Number.isSafeInteger(version) || version < 1) return json({ error: "version_required" }, 400);
    const hash = await digest(JSON.stringify({ organizationId, componentKey, version }));
    return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `cms-component-archive:${organizationId}:${componentKey}:${key}`, hash, async () => {
      const result = await database.query<Record<string, unknown>>(`UPDATE public.cms_component_definitions SET status = 'archived', updated_by = $3, updated_at = now() WHERE organization_id = $1 AND component_key = $2 AND version = $4 RETURNING id`, [organizationId, componentKey, actor, version]);
      if (!result.rows[0]) return json({ error: "component_version_conflict" }, 409);
      await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["cms.component.archive", `cms-component:${componentKey}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub, version })]);
      return json({ data: { archived: true } });
    })).response;
  }
  const action = request.method === "POST" && componentKey ? input?.action : null;
  const expectedVersion = input?.expectedVersion === undefined ? null : Number(input?.expectedVersion);
  if (expectedVersion !== null && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) return json({ error: "invalid_expected_version" }, 400);
  if (action !== null) {
    if (action !== "publish" || expectedVersion === null) return json({ error: "invalid_component_action" }, 400);
    const hash = await digest(JSON.stringify({ organizationId, componentKey, action, expectedVersion }));
    return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `cms-component-publish:${organizationId}:${componentKey}:${key}`, hash, async () => {
      const result = await database.query<Record<string, unknown>>(`UPDATE public.cms_component_definitions SET status = 'published', updated_by = $3, updated_at = now() WHERE organization_id = $1 AND component_key = $2 AND version = $4 RETURNING ${projection}`, [organizationId, componentKey, actor, expectedVersion]);
      if (!result.rows[0]) return json({ error: "component_version_conflict" }, 409);
      const data = normalize(result.rows[0]); await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["cms.component.publish", `cms-component:${componentKey}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub, version: data.version })]); return json({ data });
    })).response;
  }
  if (!input || !validDefinition(input.definition)) return json({ error: "invalid_component_definition" }, 400);
  const definition = input.definition; if (componentKey && definition.id !== componentKey) return json({ error: "component_id_mismatch" }, 400);
  const hash = await digest(JSON.stringify({ organizationId, componentKey: componentKey ?? null, definition, expectedVersion }));
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `cms-component-save:${organizationId}:${componentKey ?? definition.id}:${key}`, hash, async () => {
    try {
      const data = await withWorkerTransaction(database, async (tx) => {
        if (!await lockCmsMediaReferences(tx, organizationId, definition)) return null;
        const current = await tx.query<Record<string, unknown>>(`SELECT ${projection} FROM public.cms_component_definitions WHERE organization_id = $1 AND component_key = $2 FOR UPDATE`, [organizationId, definition.id]);
        const existing = current.rows[0] ? normalize(current.rows[0]) : null;
        if ((existing && expectedVersion === null) || (expectedVersion !== null && (!existing || existing.version !== expectedVersion))) return null;
        const nextVersion = (existing?.version ?? 0) + 1;
        const saved = existing
          ? await tx.query<Record<string, unknown>>(`UPDATE public.cms_component_definitions SET definition = $3::jsonb, version = $4, updated_by = $5, updated_at = now() WHERE organization_id = $1 AND component_key = $2 RETURNING ${projection}`, [organizationId, definition.id, JSON.stringify(definition), nextVersion, actor])
          : await tx.query<Record<string, unknown>>(`INSERT INTO public.cms_component_definitions (organization_id, component_key, definition, version, status, created_by, updated_by) VALUES ($1,$2,$3::jsonb,$4,'draft',$5,$5) RETURNING ${projection}`, [organizationId, definition.id, JSON.stringify(definition), nextVersion, actor]);
        const row = saved.rows[0]; if (!row) return null;
        await tx.query("INSERT INTO public.cms_component_definition_versions (definition_id, organization_id, version, definition, created_by) VALUES ($1,$2,$3,$4::jsonb,$5)", [row.id, organizationId, nextVersion, JSON.stringify(definition), actor]);
        return normalize(row);
      });
      if (!data) return json({ error: "component_version_conflict" }, 409);
      await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["cms.component.save", `cms-component:${data.component_key}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub, version: data.version })]);
      return json({ data });
    } catch { return json({ error: "component_write_failed" }, 500); }
  })).response;
}
