import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";

type Env = {
  NANGO_WEBHOOK_SIGNING_KEY?: string;
};

const MAX_BODY_BYTES = 256_000;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifySignature(raw: Uint8Array, provided: string | null, secret: string): Promise<boolean> {
  if (!provided || !/^[a-fA-F0-9]{64}$/.test(provided)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const stableBytes = new Uint8Array(raw.byteLength);
  stableBytes.set(raw);
  const expected = hex(await crypto.subtle.sign("HMAC", key, stableBytes.buffer));
  return constantTimeEqual(expected, provided.toLowerCase());
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, max = 256): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}

export async function handleNangoWebhook(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  const raw = await readBody(request);
  if (raw instanceof Response) return raw;
  const secret = env.NANGO_WEBHOOK_SIGNING_KEY?.trim();
  if (!secret || !(await verifySignature(raw, request.headers.get("x-nango-hmac-sha256"), secret))) {
    return json({ error: "invalid_webhook_signature" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)));
    if (!parsed) return json({ error: "invalid_json" }, 400);
    payload = parsed;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const event = text(request.headers.get("x-nango-event-id")) ?? text(request.headers.get("x-nango-webhook-id")) ?? text(payload.id) ?? text(payload.eventId);
  if (!event || !/^[A-Za-z0-9._:-]{8,200}$/.test(event)) return json({ error: "missing_replay_protection" }, 400);
  if (payload.type !== "auth" || payload.operation !== "creation" || payload.success !== true) {
    try {
      await database.query("INSERT INTO public.admin_webhook_replays(channel, nonce, correlation_id) VALUES ('nango', $1, $2) ON CONFLICT (channel, nonce) DO NOTHING", [event, "nango-webhook"]);
      return json({ accepted: true });
    } catch {
      return json({ error: "webhook_replay_store_unavailable" }, 503);
    }
  }

  const tags = record(payload.tags);
  const merchantIdentity = text(tags?.end_user_id, 256)?.toLowerCase();
  const organizationId = text(tags?.organization_id, 256);
  const providerConfigKey = text(payload.providerConfigKey, 100);
  const connectionId = text(payload.connectionId, 200);
  if (!merchantIdentity || !organizationId || !providerConfigKey || !connectionId) return json({ error: "invalid_connection_owner_metadata" }, 400);

  try {
    const outcome = await withWorkerTransaction(database, async (tx) => {
      const replay = await tx.query<{ nonce: string }>(
        "INSERT INTO public.admin_webhook_replays(channel, nonce, correlation_id) VALUES ('nango', $1, $2) ON CONFLICT (channel, nonce) DO NOTHING RETURNING nonce",
        [event, "nango-webhook"],
      );
      if (replay.rowCount !== 1) return "duplicate" as const;
      const existing = await tx.query<{ organization_id: string; nango_connection_id: string }>(
        "SELECT organization_id, nango_connection_id FROM public.payment_nango_connections WHERE provider_config_key = $1 AND merchant_identity = $2 FOR UPDATE",
        [providerConfigKey, merchantIdentity],
      );
      if (existing.rows.length && existing.rows[0].organization_id !== organizationId) throw new Error("connection_owner_conflict");
      await tx.query(
        `INSERT INTO public.payment_nango_connections(provider_config_key, nango_connection_id, merchant_identity, organization_id, provider, metadata, active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, true, now())
         ON CONFLICT (provider_config_key, merchant_identity) DO UPDATE SET nango_connection_id = EXCLUDED.nango_connection_id, organization_id = EXCLUDED.organization_id, provider = EXCLUDED.provider, metadata = EXCLUDED.metadata, active = true, updated_at = now()`,
        [providerConfigKey, connectionId, merchantIdentity, organizationId, text(payload.provider, 100), JSON.stringify({ auth_mode: payload.authMode ?? null, environment: payload.environment ?? null })],
      );
      return "stored" as const;
    });
    return json({ accepted: true, ...(outcome === "duplicate" ? { deduplicated: true } : {}) });
  } catch (error) {
    if (error instanceof Error && error.message === "connection_owner_conflict") return json({ error: "connection_owner_conflict" }, 409);
    return json({ error: "connection_persistence_failed" }, 503);
  }
}
