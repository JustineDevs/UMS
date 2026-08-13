import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { configuredPaymentIntegrations } from "@/lib/payment-nango";
import { parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";
import { resolveStaffOrganization } from "@/lib/staff-organization";

const reconnectSchema = z
  .object({
    provider_config_key: z.string().trim().min(1).max(100),
    nango_connection_id: z.string().trim().min(1).max(200),
  })
  .strict();

async function post(request: Request) {
  const cid = getCorrelationId(request);
  const staff = await requireStaffApiSession("settings:write");
  if (!staff.ok) return staff.response;
  const apiKey = process.env.NANGO_API_KEY?.trim();
  if (!apiKey)
    return correlatedJson(
      cid,
      { error: "Nango is not configured" },
      { status: 503 },
    );
  const parsed = await parseAdminJson(request, reconnectSchema);
  if (!parsed.ok)
    return correlatedJson(
      cid,
      { error: parsed.error },
      { status: parsed.status },
    );
  const integrationId = parsed.data.provider_config_key;
  const connectionId = parsed.data.nango_connection_id;
  if (
    !connectionId ||
    !configuredPaymentIntegrations().some((item) => item.id === integrationId)
  )
    return correlatedJson(
      cid,
      { error: "Invalid payment connection" },
      { status: 400 },
    );
  const identity = (staff.session.user?.email ?? "local-admin@localhost")
    .trim()
    .toLowerCase();
  const sup = adminSupabaseOr503(cid);
  if (!("response" in sup)) {
    const organization = await resolveStaffOrganization(
      sup.client,
      staff.session.user?.email,
    );
    if (!organization)
      return correlatedJson(
        cid,
        { error: "Organization membership is not configured" },
        { status: 403 },
      );
    const { data } = await sup.client
      .from("payment_nango_connections")
      .select("nango_connection_id")
      .eq("organization_id", organization.id)
      .eq("merchant_identity", identity)
      .eq("provider_config_key", integrationId)
      .eq("nango_connection_id", connectionId)
      .maybeSingle();
    if (!data)
      return correlatedJson(
        cid,
        { error: "Payment connection not found" },
        { status: 404 },
      );
  }
  const response = await fetch(
    "https://api.nango.dev/connect/sessions/reconnect",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connection_id: connectionId,
        integration_id: integrationId,
        tags: { end_user_id: identity, end_user_email: identity },
      }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { token?: string };
  };
  if (!response.ok || !payload.data?.token)
    return correlatedJson(
      cid,
      { error: "Unable to start payment provider reconnect" },
      { status: 502 },
    );
  return correlatedJson(cid, {
    data: { session_token: payload.data.token, integration_id: integrationId },
  });
}

export const POST = withAdminMutationIdempotency("/admin/payments/connections/reconnect:POST", post);
