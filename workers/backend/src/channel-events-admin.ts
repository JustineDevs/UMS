import { verifyWorkerBearerToken } from "./auth.ts";
import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = {
  CMS_ADMIN_JWT_SECRET?: string;
  SUPABASE_URL?: string;
  CHANNEL_WEBHOOK_SECRET?: string;
  CHANNEL_TENANT_KEY?: string;
  CHANNEL_ALLOWED_IDS?: string;
};

const MAX_BODY_BYTES = 512_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function configuredTenant(env: Env): string | null {
  const tenant = env.CHANNEL_TENANT_KEY?.trim();
  return tenant && /^[A-Za-z0-9._:-]{1,128}$/.test(tenant) ? tenant : null;
}

function canManage(claims: NonNullable<Awaited<ReturnType<typeof verifyWorkerBearerToken>>>): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === "channels:manage");
}

function containsDangerousKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsDangerousKey);
  return Object.entries(value).some(([key, nested]) =>
    ["__proto__", "constructor", "prototype"].includes(key) || containsDangerousKey(nested),
  );
}

function digestHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifySignature(raw: Uint8Array, tenant: string, timestamp: string, signature: string | null, secret: string): Promise<boolean> {
  const epoch = Number(timestamp);
  if (!Number.isSafeInteger(epoch) || Math.abs(Date.now() / 1000 - epoch) > 300) return false;
  const provided = (signature ?? "").trim().replace(/^sha256=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prefix = encoder.encode(`${timestamp}.${tenant}:`);
  const signed = new Uint8Array(prefix.byteLength + raw.byteLength);
  signed.set(prefix);
  signed.set(raw, prefix.byteLength);
  const expected = digestHex(await crypto.subtle.sign("HMAC", key, signed));
  return constantTimeEqual(expected, provided.toLowerCase());
}

async function readBody(request: Request): Promise<Uint8Array | Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return json({ error: "payload_too_large" }, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function handleChannelWebhookRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const tenant = configuredTenant(env);
  const secret = env.CHANNEL_WEBHOOK_SECRET?.trim();
  if (!tenant || !secret) return json({ error: "channel_webhook_not_configured" }, 503);

  const requestedTenant = request.headers.get("x-tenant-key")?.trim() ?? "";
  if (requestedTenant !== tenant) return json({ error: "invalid_tenant_scope" }, 403);
  const raw = await readBody(request);
  if (raw instanceof Response) return raw;
  const timestamp = request.headers.get("x-channel-timestamp")?.trim() ?? "";
  if (!(await verifySignature(raw, tenant, timestamp, request.headers.get("x-channel-signature"), secret))) {
    return json({ error: "invalid_webhook_signature" }, 401);
  }
  const nonce = request.headers.get("x-channel-nonce")?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{16,200}$/.test(nonce)) return json({ error: "missing_replay_protection" }, 400);

  let payload: Record<string, unknown>;
  try {
    const decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)) as unknown;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded) || containsDangerousKey(decoded)) return json({ error: "invalid_payload" }, 400);
    payload = decoded as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  for (const key of ["channel", "source", "event_type", "type"]) {
    if (key in payload && (typeof payload[key] !== "string" || payload[key].trim().length > 256)) return json({ error: "invalid_field" }, 400);
  }
  const channel = typeof payload.channel === "string" ? payload.channel.trim() : typeof payload.source === "string" ? payload.source.trim() : "unknown";
  const allowedChannels = (env.CHANNEL_ALLOWED_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!channel || channel.length > 256 || (allowedChannels.length > 0 && !allowedChannels.includes(channel))) return json({ error: "channel_not_authorized" }, 403);
  const eventType = typeof payload.event_type === "string" ? payload.event_type.trim() : typeof payload.type === "string" ? payload.type.trim() : "ingest";
  const hashInput = new Uint8Array(raw.byteLength);
  hashInput.set(raw);
  const payloadHash = digestHex(await crypto.subtle.digest("SHA-256", hashInput));
  const correlationId = request.headers.get("x-request-id")?.trim().slice(0, 128) || crypto.randomUUID();

  try {
    const outcome = await withWorkerTransaction(database, async (transaction) => {
      const replay = await transaction.query(
        `INSERT INTO public.admin_webhook_replays(channel, nonce, correlation_id)
         VALUES ($1, $2, $3) ON CONFLICT (channel, nonce) DO NOTHING RETURNING id`,
        [`${tenant}:${channel}`, nonce, correlationId],
      );
      if (replay.rowCount !== 1) return "replay" as const;
      const inserted = await transaction.query(
        `INSERT INTO public.channel_sync_events(tenant_key, channel, event_type, payload, payload_hash, metadata)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb)
         ON CONFLICT (tenant_key, channel, payload_hash) WHERE payload_hash IS NOT NULL DO NOTHING
         RETURNING id`,
        [tenant, channel, eventType, JSON.stringify(payload), payloadHash, JSON.stringify({ correlation_id: correlationId, nonce })],
      );
      return inserted.rowCount === 1 ? "inserted" as const : "duplicate" as const;
    });
    if (outcome === "replay") return json({ error: "webhook_replay_detected" }, 409);
    return json({ ok: true, ...(outcome === "duplicate" ? { deduplicated: true } : {}) });
  } catch {
    return json({ error: "channel_event_persistence_failed" }, 503);
  }
}

export async function handleChannelEventListRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canManage(claims)) return json({ error: "forbidden" }, 403);
  const tenant = configuredTenant(env);
  if (!tenant) return json({ error: "channel_tenant_scope_not_configured" }, 503);
  const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? "80");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 80;
  try {
    const result = await database.query(
      `SELECT id, channel, event_type, received_at, processed_at
         FROM public.channel_sync_events WHERE tenant_key = $1
        ORDER BY received_at DESC, id DESC LIMIT $2`,
      [tenant, limit],
    );
    return json({ events: result.rows });
  } catch {
    return json({ error: "channel_events_unavailable" }, 503);
  }
}

export async function handleChannelEventProcessRequest(request: Request, database: WorkerDatabaseClient, env: Env, id: string): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!canManage(claims)) return json({ error: "forbidden" }, 403);
  const tenant = configuredTenant(env);
  if (!tenant) return json({ error: "channel_tenant_scope_not_configured" }, 503);
  if (!UUID.test(id)) return json({ error: "invalid_event_id" }, 400);
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) return json({ error: "idempotency_key_required" }, 400);
  const requestHash = digestHex(await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify({ id, tenant }))));
  const scopedKey = digestHex(await crypto.subtle.digest("SHA-256", encoder.encode(`channel-event-process:${claims.sub}:${tenant}:${id}:${idempotencyKey}`)));
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), scopedKey, requestHash, async () => {
    try {
      const event = await withWorkerTransaction(database, async (transaction) => {
        const updated = await transaction.query<{ id: string; processed_at: string }>(
          `UPDATE public.channel_sync_events SET processed_at = now()
            WHERE id = $1::uuid AND tenant_key = $2 AND processed_at IS NULL
            RETURNING id, processed_at`,
          [id, tenant],
        );
        if (!updated.rows[0]) {
          const existing = await transaction.query<{ id: string; processed_at: string }>(
            `SELECT id, processed_at FROM public.channel_sync_events
              WHERE id = $1::uuid AND tenant_key = $2 AND processed_at IS NOT NULL`,
            [id, tenant],
          );
          return existing.rows[0] ? { ...existing.rows[0], alreadyProcessed: true } : null;
        }
        await transaction.query(
          "INSERT INTO public.audit_logs(action, resource, details) VALUES ($1, $2, $3::jsonb)",
          ["channel_event.process", "channel_sync_event", JSON.stringify({ organization_id: claims.organization_id ?? claims.org_id ?? null, actor_subject: claims.sub, event_id: id, tenant_key: tenant, processed_at: updated.rows[0].processed_at })],
        );
        return { ...updated.rows[0], alreadyProcessed: false };
      });
      return event ? json({ event }) : json({ error: "event_not_found" }, 404);
    } catch {
      return json({ error: "channel_event_processing_failed" }, 503);
    }
  })).response;
}
