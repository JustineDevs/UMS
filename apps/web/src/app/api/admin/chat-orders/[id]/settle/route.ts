import { z } from "zod";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson, claimAdminIdempotency, completeAdminIdempotency, getIdempotencyKey, getRequestHash } from "@/lib/admin-api-security";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { insertStaffAuditLog } from "@/lib/staff-audit";

const schema = z.object({
  provider: z.enum(["stripe", "paypal", "xendit"]),
  payment_external_id: z.string().trim().min(1).max(255),
  payment_request_id: z.string().trim().min(8).max(160).optional(),
  action: z.enum(["retrieve", "capture"]).default("capture"),
}).strict();

function settled(provider: string, status: string | undefined) {
  const value = String(status ?? "").toLowerCase();
  return provider === "stripe" ? value === "succeeded" : ["completed", "succeeded", "paid", "captured"].includes(value);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("chat_orders:manage");
  if (!staff.ok) return staff.response;
  const parsed = await parseAdminJson(req, schema);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const { id } = await params;
  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });
  const actor = staff.session.user?.email?.trim().toLowerCase() ?? "system";
  const claim = await claimAdminIdempotency(sup.client, { actorKey: `${organization.id}:${actor}`, actionKey: `chat-order.settle:${id}`, idempotencyKey, requestHash: getRequestHash(parsed.data) });
  if (claim.kind === "replay") return correlatedJson(correlationId, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(correlationId, { error: "Idempotency key was already used with another request" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(correlationId, { error: "Idempotency service unavailable" }, { status: 503 });
  const current = await sup.client.from("chat_order_intake").select("id,status,payment_provider,payment_external_id,payment_status").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (current.error || !current.data) {
    const body = { error: "Chat order not found" };
    await completeAdminIdempotency(sup.client, claim.id, 404, body);
    return correlatedJson(correlationId, body, { status: 404 });
  }
  if (["completed", "cancelled"].includes(String(current.data.status))) {
    const body = { error: "Chat order is not available for settlement", code: "CHAT_ORDER_TERMINAL" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const connection = await sup.client.from("payment_nango_connections").select("nango_connection_id,provider_config_key").eq("organization_id", organization.id).eq("provider", parsed.data.provider).eq("active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (connection.error || !connection.data?.nango_connection_id) {
    const body = { error: `${parsed.data.provider} is not connected for this organization`, code: "PAYMENT_CONNECTION_REQUIRED" };
    await completeAdminIdempotency(sup.client, claim.id, 409, body);
    return correlatedJson(correlationId, body, { status: 409 });
  }
  const internalToken = process.env.MEDUSA_INTERNAL_ADMIN_TOKEN?.trim();
  if (!internalToken) return correlatedJson(correlationId, { error: "Payment operations are not configured" }, { status: 503 });
  const operation = parsed.data.provider === "stripe"
    ? { operation: "payment", action: parsed.data.action, payment_id: parsed.data.payment_external_id, idempotency_key: idempotencyKey }
    : parsed.data.provider === "paypal"
      ? { operation: "payment", action: parsed.data.action, order_id: parsed.data.payment_external_id, idempotency_key: idempotencyKey }
      : { operation: "payment", action: parsed.data.action, payment_request_id: parsed.data.payment_request_id ?? parsed.data.payment_external_id, payment_id: parsed.data.payment_external_id, idempotency_key: idempotencyKey };
  const response = await medusaAdminFetch(`/admin/payment-provider/${parsed.data.provider}`, { method: "POST", headers: { "x-uvs-internal-token": internalToken, "x-nango-connection-id": connection.data.nango_connection_id, ...(connection.data.provider_config_key ? { "x-nango-provider-config-key": connection.data.provider_config_key } : {}) }, body: JSON.stringify(operation) });
  const providerBody = await response.json().catch(() => ({})) as { data?: { id?: string; status?: string; payment_request_id?: string }; error?: string };
  if (!response.ok) {
    const body = { error: providerBody.error ?? "Provider settlement failed", code: "PAYMENT_SETTLEMENT_FAILED" };
    await sup.client.from("chat_order_intake").update({ payment_provider: parsed.data.provider, payment_external_id: parsed.data.payment_external_id, payment_status: "failed", payment_last_error: body.error }).eq("id", id).eq("organization_id", organization.id);
    await completeAdminIdempotency(sup.client, claim.id, 502, body);
    return correlatedJson(correlationId, body, { status: 502 });
  }
  const status = String(providerBody.data?.status ?? "").toLowerCase();
  const nextPaymentStatus = settled(parsed.data.provider, status) ? "settled" : status || "pending";
  const update = await sup.client.from("chat_order_intake").update({ payment_provider: parsed.data.provider, payment_external_id: parsed.data.payment_external_id, payment_status: nextPaymentStatus, payment_settled_at: nextPaymentStatus === "settled" ? new Date().toISOString() : null, payment_last_error: null, status: nextPaymentStatus === "settled" ? "processing" : current.data.status }).eq("id", id).eq("organization_id", organization.id).select("id,status,updated_at,payment_provider,payment_external_id,payment_status,payment_settled_at").single();
  if (update.error || !update.data) {
    const body = { error: "Payment settled but chat order state could not be recorded", code: "PAYMENT_STATE_PERSIST_FAILED" };
    await completeAdminIdempotency(sup.client, claim.id, 502, body);
    return correlatedJson(correlationId, body, { status: 502 });
  }
  await insertStaffAuditLog(sup.client, { actorEmail: actor, action: "chat_order.payment_settle", resource: "chat_order_intake", resourceId: id, details: { organization_id: organization.id, provider: parsed.data.provider, external_id: parsed.data.payment_external_id, status: nextPaymentStatus } });
  const body = { data: update.data, provider: providerBody.data ?? null };
  await completeAdminIdempotency(sup.client, claim.id, 200, body);
  return correlatedJson(correlationId, body);
}
