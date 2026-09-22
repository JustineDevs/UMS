import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const text = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const tenant = (claims: WorkerAuthClaims) => { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; };
const allowed = (claims: WorkerAuthClaims, write: boolean) => claims.role === "owner" || claims.role === "admin" || (Array.isArray(claims.permissions) && claims.permissions.some((value) => value === "*" || value === (write ? "pos:shift_manage" : "pos:use")));
const projection = "id, organization_id, jurisdiction, registration_number, invoice_prefix, enabled, created_at";
const certificationProjection = "id, organization_id, provider, model, firmware, certification_id, expires_at, active, created_at";
const terminalProjection = "id, organization_id, device_id, provider, model, serial_number, status, certification_id, last_health_at, metadata, provider_terminal_external_id, payment_provider_artifact_id, created_at";

export async function handleAdminPosEnterpriseRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims); if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  if (!allowed(claims, request.method !== "GET")) return json({ error: "forbidden" }, 403);
  if (request.method === "GET") {
    const [fiscal, certifications, terminals] = await Promise.all([
      database.query(`SELECT ${projection} FROM public.pos_fiscal_profiles WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`, [organizationId, 100]),
      database.query(`SELECT ${certificationProjection} FROM public.pos_terminal_certifications WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`, [organizationId, 100]),
      database.query(`SELECT ${terminalProjection} FROM public.pos_payment_terminals WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`, [organizationId, 100]),
    ]);
    return json({ data: { fiscal: fiscal.rows, certifications: certifications.rows, paymentTerminals: terminals.rows } });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const key = request.headers.get("Idempotency-Key")?.trim(); if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  let body: Record<string, unknown>; try { const raw = await request.text(); if (raw.length > 128 * 1024) return json({ error: "payload_too_large" }, 413); const parsed = JSON.parse(raw) as unknown; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_json" }, 400); body = parsed as Record<string, unknown>; } catch { return json({ error: "invalid_json" }, 400); }
  const kind = text(body.kind, 32); if (!kind || !["fiscal", "certification", "payment_terminal"].includes(kind)) return json({ error: "invalid_pos_control_kind" }, 400);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ organizationId, kind, body }))).then((bytes) => Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join(""));
  const actor = text(claims.email, 320) ?? claims.sub;
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `pos-enterprise:${organizationId}:${key}`, hash, async () => {
    let result;
    if (kind === "fiscal") { const jurisdiction = text(body.jurisdiction, 16); const registration = text(body.registrationNumber, 64); const prefix = text(body.invoicePrefix, 16); if (!jurisdiction || !registration || !prefix) return json({ error: "invalid_fiscal_profile" }, 400); result = await database.query(`INSERT INTO public.pos_fiscal_profiles (organization_id,jurisdiction,registration_number,invoice_prefix,enabled) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id,jurisdiction,registration_number) DO UPDATE SET invoice_prefix=EXCLUDED.invoice_prefix,enabled=EXCLUDED.enabled RETURNING ${projection}`, [organizationId, jurisdiction, registration, prefix, body.enabled === true]); }
    else if (kind === "certification") { const provider = text(body.provider, 120); const model = text(body.model, 120); const firmware = text(body.firmware, 80); const certificationId = text(body.certificationId, 120); if (!provider || !model || !firmware || !certificationId) return json({ error: "invalid_terminal_certification" }, 400); result = await database.query(`INSERT INTO public.pos_terminal_certifications (organization_id,provider,model,firmware,certification_id,expires_at) VALUES ($1,$2,$3,$4,$5,$6::timestamptz) ON CONFLICT (organization_id,certification_id) DO UPDATE SET provider=EXCLUDED.provider,model=EXCLUDED.model,firmware=EXCLUDED.firmware,expires_at=EXCLUDED.expires_at RETURNING ${certificationProjection}`, [organizationId, provider, model, firmware, certificationId, text(body.expiresAt, 64)]); }
    else { const provider = text(body.provider, 120); const model = text(body.model, 120); const serial = text(body.serialNumber, 120); if (!provider || !model || !serial) return json({ error: "invalid_payment_terminal" }, 400); result = await database.query(`INSERT INTO public.pos_payment_terminals (organization_id,device_id,provider,model,serial_number,provider_terminal_external_id,certification_id,status,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (organization_id,serial_number) DO UPDATE SET device_id=EXCLUDED.device_id,provider=EXCLUDED.provider,model=EXCLUDED.model,provider_terminal_external_id=EXCLUDED.provider_terminal_external_id,certification_id=EXCLUDED.certification_id,status=EXCLUDED.status,metadata=EXCLUDED.metadata RETURNING ${terminalProjection}`, [organizationId, text(body.deviceId, 64), provider, model, serial, text(body.providerTerminalExternalId, 255), text(body.certificationId, 120), ["pending", "certified", "degraded", "disabled"].includes(String(body.status)) ? body.status : "pending", JSON.stringify(body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {})]); }
    const row = result.rows[0]; if (!row) return json({ error: "pos_control_write_failed" }, 502); await database.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", [`pos.${kind}.upsert`, `pos:${kind}`, JSON.stringify({ organization_id: organizationId, actor_subject: actor })]); return json({ data: row }, 201);
  })).response;
}
