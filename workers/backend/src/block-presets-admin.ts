import type { WorkerDatabaseClient } from "./database.ts";
import { withWorkerTransaction } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
type Block = { id: string; type: string; props: Record<string, unknown> };
type Preset = { id: string; name: string; blocks: Block[]; created_at: string };

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
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === needed || !write && value === "content:write");
}
function normalizeBlocks(value: unknown): Block[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const blocks: Block[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (typeof row.type !== "string" || !row.type.trim() || row.type.length > 160) return null;
    const props = row.props && typeof row.props === "object" && !Array.isArray(row.props) ? row.props as Record<string, unknown> : {};
    const id = typeof row.id === "string" && row.id.trim() ? row.id : `blk_${index}`;
    if (id.length > 160) return null;
    blocks.push({ id, type: row.type.trim(), props });
  }
  return blocks;
}
function normalize(row: Record<string, unknown>): Preset {
  return { id: String(row.id), name: String(row.name ?? ""), blocks: normalizeBlocks(row.blocks) ?? [], created_at: String(row.created_at ?? "") };
}
async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleAdminBlockPresetsRequest(request: Request, database: WorkerDatabaseClient, env: Env, presetId?: string): Promise<Response> {
  if (!["GET", "POST", "DELETE"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  const organizationId = tenant(claims);
  if (!organizationId) return json({ error: "organization_claim_required" }, 403);
  const write = request.method !== "GET";
  if (!allowed(claims, write)) return json({ error: "forbidden" }, 403);
  if (presetId && !/^[0-9a-f-]{16,80}$/i.test(presetId)) return json({ error: "invalid_preset_id" }, 400);
  if (request.method === "GET") {
    const limitValue = Number(new URL(request.url).searchParams.get("limit") ?? "500");
    const limit = Number.isSafeInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 500) : 500;
    const result = await database.query<Record<string, unknown>>(
      `SELECT id, name, blocks, created_at FROM public.cms_page_block_presets WHERE organization_id = $1 ${presetId ? "AND id = $2" : ""} ORDER BY created_at DESC LIMIT $${presetId ? 3 : 2}`,
      presetId ? [organizationId, presetId, limit] : [organizationId, limit],
    );
    return json({ data: presetId ? (result.rows[0] ? normalize(result.rows[0]) : null) : result.rows.map(normalize) });
  }
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  if (request.method === "POST") {
    let body: unknown;
    try { const raw = await request.text(); if (raw.length > 512 * 1024) return json({ error: "payload_too_large" }, 413); body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_preset_payload" }, 400);
    const input = body as Record<string, unknown>;
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const blocks = normalizeBlocks(input.blocks);
    if (!name || name.length > 160 || !blocks) return json({ error: "invalid_preset_payload" }, 400);
    const requestHash = await digest(JSON.stringify({ organizationId, name, blocks }));
    return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `cms-preset:${organizationId}:${key}`, requestHash, async () => {
      const result = await database.query<Record<string, unknown>>(
        `INSERT INTO public.cms_page_block_presets (name, blocks, organization_id) VALUES ($1, $2::jsonb, $3) RETURNING id, name, blocks, created_at`,
        [name, JSON.stringify(blocks), organizationId],
      );
      const row = result.rows[0];
      if (!row) return json({ error: "preset_write_failed" }, 500);
      await database.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["cms.block_preset.create", `block-preset:${row.id}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub })]);
      return json({ data: normalize(row) }, 201);
    })).response;
  }
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), `cms-preset-delete:${organizationId}:${presetId}:${key}`, await digest(`${organizationId}:${presetId}`), async () => withWorkerTransaction(database, async (tx) => {
    const result = await tx.query("DELETE FROM public.cms_page_block_presets WHERE id = $1 AND organization_id = $2", [presetId, organizationId]);
    if (!result.rowCount) return json({ error: "not_found" }, 404);
    await tx.query("INSERT INTO public.audit_logs (action, resource, details) VALUES ($1, $2, $3::jsonb)", ["cms.block_preset.delete", `block-preset:${presetId}`, JSON.stringify({ organization_id: organizationId, actor_subject: claims.sub })]);
    return json({ ok: true });
  }))).response;
}
