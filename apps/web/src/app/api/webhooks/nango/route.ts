import crypto from "node:crypto";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { correlatedJson } from "@/lib/staff-api-response";
import { containsDangerousKey } from "@/lib/admin-api-security";

function validSignature(
  raw: string,
  provided: string | null,
  secret: string,
): boolean {
  if (!provided) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 256_000) {
    return correlatedJson(
      "nango-webhook",
      { error: "Payload too large" },
      { status: 413 },
    );
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 256_000) {
    return correlatedJson(
      "nango-webhook",
      { error: "Payload too large" },
      { status: 413 },
    );
  }
  const secret = process.env.NANGO_WEBHOOK_SIGNING_KEY?.trim();
  if (
    !secret ||
    !validSignature(raw, request.headers.get("x-nango-hmac-sha256"), secret)
  ) {
    return correlatedJson(
      "nango-webhook",
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      containsDangerousKey(parsed)
    )
      throw new Error("invalid");
    payload = parsed as Record<string, unknown>;
  } catch {
    return correlatedJson(
      "nango-webhook",
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }
  const eventIdValue =
    request.headers.get("x-nango-event-id") ??
    request.headers.get("x-nango-webhook-id") ??
    payload.id ??
    payload.eventId;
  const eventId = typeof eventIdValue === "string" ? eventIdValue.trim() : "";
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(eventId)) {
    return correlatedJson(
      "nango-webhook",
      { error: "Missing replay protection" },
      { status: 400 },
    );
  }
  if (
    payload.type !== "auth" ||
    payload.operation !== "creation" ||
    payload.success !== true
  ) {
    return correlatedJson("nango-webhook", { accepted: true });
  }
  const tags = (payload.tags ?? {}) as Record<string, unknown>;
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
    return correlatedJson(
      "nango-webhook",
      { error: "Invalid connection ownership tags" },
      { status: 400 },
    );
  }
  const merchantIdentity =
    typeof tags.end_user_id === "string"
      ? tags.end_user_id.trim().toLowerCase()
      : "";
  const organizationId =
    typeof tags.organization_id === "string" ? tags.organization_id.trim() : "";
  const providerConfigKey =
    typeof payload.providerConfigKey === "string"
      ? payload.providerConfigKey.trim()
      : "";
  const connectionId =
    typeof payload.connectionId === "string" ? payload.connectionId.trim() : "";
  if (
    !merchantIdentity ||
    !organizationId ||
    !providerConfigKey ||
    !connectionId
  ) {
    return correlatedJson(
      "nango-webhook",
      { error: "Missing connection ownership tags" },
      { status: 400 },
    );
  }
  if (
    [merchantIdentity, organizationId, providerConfigKey, connectionId].some(
      (value) => value.length > 256,
    )
  ) {
    return correlatedJson(
      "nango-webhook",
      { error: "Invalid connection ownership tags" },
      { status: 400 },
    );
  }
  const sup = adminSupabaseOr503("nango-webhook");
  if ("response" in sup) return sup.response;
  const replay = await sup.client.from("admin_webhook_replays").insert({
    channel: "nango",
    nonce: eventId,
    correlation_id: "nango-webhook",
  });
  if (replay.error?.code === "23505")
    return correlatedJson("nango-webhook", {
      accepted: true,
      deduplicated: true,
    });
  if (replay.error)
    return correlatedJson(
      "nango-webhook",
      { error: "Unable to validate webhook replay" },
      { status: 502 },
    );
  const existing = await sup.client
    .from("payment_nango_connections")
    .select("organization_id,nango_connection_id")
    .eq("provider_config_key", providerConfigKey)
    .eq("merchant_identity", merchantIdentity)
    .maybeSingle();
  if (existing.error) {
    return correlatedJson(
      "nango-webhook",
      { error: "Unable to validate connection ownership" },
      { status: 502 },
    );
  }
  if (existing.data && existing.data.organization_id !== organizationId) {
    return correlatedJson(
      "nango-webhook",
      { error: "Connection ownership conflict" },
      { status: 409 },
    );
  }
  const { error } = await sup.client.from("payment_nango_connections").upsert(
    {
      provider_config_key: providerConfigKey,
      nango_connection_id: connectionId,
      merchant_identity: merchantIdentity,
      organization_id: organizationId,
      provider: typeof payload.provider === "string" ? payload.provider : null,
      metadata: {
        auth_mode: payload.authMode ?? null,
        environment: payload.environment ?? null,
      },
      active: true,
    },
    { onConflict: "provider_config_key,merchant_identity" },
  );
  if (error)
    return correlatedJson(
      "nango-webhook",
      { error: "Failed to persist Nango connection reference" },
      { status: 502 },
    );
  return correlatedJson("nango-webhook", { accepted: true });
}
