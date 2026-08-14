import { tryCreateSupabaseClient } from "@universal-music-store/database";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { gateChannelWebhookSecretConfigured } from "@/lib/channel-webhook-policy";
import { verifyChannelWebhookSignature } from "@/lib/channel-webhook-signature";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import {
  containsDangerousKey,
  verifySignedRequest,
} from "@/lib/admin-api-security";
import {
  hashChannelPayload,
  validateChannelScope,
} from "@/lib/channel-security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req);
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 512_000)
    return correlatedJson(
      correlationId,
      { error: "Payload too large" },
      { status: 413 },
    );
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > 512_000)
    return correlatedJson(
      correlationId,
      { error: "Payload too large" },
      { status: 413 },
    );
  const secret = process.env.CHANNEL_WEBHOOK_SECRET?.trim();
  const gate = gateChannelWebhookSecretConfigured(
    secret,
    process.env.VERCEL_ENV,
    process.env.NODE_ENV,
  );
  if (!gate.ok) {
    logAdminApiEvent({
      route: "POST /api/integrations/channels/webhook",
      correlationId,
      phase: "error",
      detail: { reason: "missing_channel_webhook_secret" },
    });
    return correlatedJson(
      correlationId,
      { error: gate.error },
      { status: gate.status },
    );
  }
  const tenantHeader = req.headers.get("x-tenant-key")?.trim();
  if (!tenantHeader || !/^[A-Za-z0-9._:-]{1,128}$/.test(tenantHeader)) {
    return correlatedJson(
      correlationId,
      { error: "Missing tenant scope" },
      { status: 400 },
    );
  }
  if (secret) {
    const sig = req.headers.get("x-channel-signature") ?? "";
    const timestamp = req.headers.get("x-channel-timestamp") ?? "";
    const signed = timestamp
      ? verifySignedRequest(
          `${tenantHeader || "default"}:${raw}`,
          secret,
          sig,
          timestamp,
        )
      : process.env.NODE_ENV !== "production" &&
        verifyChannelWebhookSignature(
          `${tenantHeader || "default"}:${raw}`,
          secret,
          sig,
        );
    if (!signed) {
      logAdminApiEvent({
        route: "POST /api/integrations/channels/webhook",
        correlationId,
        phase: "error",
        detail: { reason: "bad_signature" },
      });
      return correlatedJson(
        correlationId,
        { error: "Invalid signature" },
        { status: 401 },
      );
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("object_required");
    payload = parsed as Record<string, unknown>;
    if (containsDangerousKey(payload)) throw new Error("unsafe_payload");
    for (const key of ["channel", "source", "event_type", "type"]) {
      if (
        key in payload &&
        (typeof payload[key] !== "string" || String(payload[key]).length > 256)
      )
        throw new Error("invalid_field");
    }
  } catch {
    return correlatedJson(
      correlationId,
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }

  let channel = "unknown";
  if (typeof payload.channel === "string") channel = payload.channel;
  else if (typeof payload.source === "string") channel = payload.source;
  const requestedTenant = tenantHeader;
  const allowedChannels = (process.env.MEDUSA_SALES_CHANNEL_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    allowedChannels.length &&
    !validateChannelScope({ requested: channel, allowed: allowedChannels })
  ) {
    return correlatedJson(
      correlationId,
      { error: "Channel is not authorized" },
      { status: 403 },
    );
  }

  let eventType = "ingest";
  if (typeof payload.event_type === "string") eventType = payload.event_type;
  else if (typeof payload.type === "string") eventType = payload.type;

  try {
    const supabase = tryCreateSupabaseClient();
    if (!supabase) {
      return correlatedJson(
        correlationId,
        {
          error: "Supabase is not configured",
          code: "SUPABASE_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }
    const nonce = req.headers.get("x-channel-nonce")?.trim();
    if (
      process.env.NODE_ENV === "production" &&
      (!nonce || nonce.length < 16)
    ) {
      return correlatedJson(
        correlationId,
        { error: "Missing replay protection" },
        { status: 400 },
      );
    }
    if (nonce && !/^[A-Za-z0-9._:-]{16,200}$/.test(nonce)) {
      return correlatedJson(
        correlationId,
        { error: "Invalid replay token" },
        { status: 400 },
      );
    }
    if (nonce) {
      const { error: replayError } = await supabase
        .from("admin_webhook_replays")
        .insert({
          channel: `${requestedTenant}:${channel}`,
          nonce,
          correlation_id: correlationId,
        });
      if (replayError) {
        return correlatedJson(
          correlationId,
          { error: "Duplicate or invalid webhook" },
          { status: 409 },
        );
      }
    }
    const { error } = await supabase.from("channel_sync_events").insert({
      tenant_key: requestedTenant,
      channel,
      event_type: eventType,
      payload,
      payload_hash: hashChannelPayload(raw),
      metadata: { correlation_id: correlationId, nonce: nonce ?? null },
    });
    if (error?.code === "23505") {
      logAdminApiEvent({
        route: "POST /api/integrations/channels/webhook",
        correlationId,
        phase: "ok",
        detail: { channel, deduplicated: true },
      });
      return correlatedJson(correlationId, { ok: true, deduplicated: true });
    }
    if (error) {
      logAdminApiEvent({
        route: "POST /api/integrations/channels/webhook",
        correlationId,
        phase: "error",
        detail: { db: error.message },
      });
      return correlatedJson(
        correlationId,
        { error: "Unable to persist event" },
        { status: 502 },
      );
    }
  } catch {
    return correlatedJson(
      correlationId,
      { error: "Unable to process webhook" },
      { status: 502 },
    );
  }

  logAdminApiEvent({
    route: "POST /api/integrations/channels/webhook",
    correlationId,
    phase: "ok",
    detail: { channel },
  });

  return correlatedJson(correlationId, { ok: true });
}
