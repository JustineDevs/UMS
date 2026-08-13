import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";
import {
  configuredPaymentIntegrations,
  nangoErrorMessage,
  paymentIntegrationLabel,
  type PaymentNangoConnection,
} from "@/lib/payment-nango";
import {
  resolveStaffOrganization,
  organizationCanManagePayments,
} from "@/lib/staff-organization";
import {
  stripeAvailableForMerchant,
  STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
} from "@/lib/payment-country-policy";

export const dynamic = "force-dynamic";

const connectionSchema = z
  .object({
    provider_config_key: z.string().trim().min(1).max(100),
    connection_id: z.string().trim().min(1).max(200),
  })
  .strict();

const disconnectSchema = z
  .object({
    provider_config_key: z.string().trim().min(1).max(100),
    nango_connection_id: z.string().trim().min(1).max(200),
  })
  .strict();

async function nangoConnections(
  apiKey: string,
  identity: string,
  allowed: string[],
) {
  const query = new URLSearchParams({
    "tags[end_user_id]": identity,
    limit: "100",
  });
  const response = await fetch(
    `https://api.nango.dev/connections?${query.toString()}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    connections?: Array<Record<string, unknown>>;
  };
  if (!response.ok) throw new Error("Nango connection status unavailable");
  return (payload.connections ?? []).filter((connection) => {
    const key =
      typeof connection.provider_config_key === "string"
        ? connection.provider_config_key
        : "";
    const tags = connection.tags as Record<string, unknown> | undefined;
    return allowed.includes(key) && tags?.end_user_id === identity;
  });
}

async function storedConnections(
  identity: string,
  organizationId: string,
  cid: string,
) {
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const { data, error } = await sup.client
    .from("payment_nango_connections")
    .select(
      "provider_config_key,nango_connection_id,provider,active,updated_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error)
    return correlatedJson(
      cid,
      { error: "Unable to load payment connection status" },
      { status: 502 },
    );
  const configured = configuredPaymentIntegrations();
  const known = new Set(configured.map((item) => item.id));
  const integrations = [
    ...configured,
    ...(data ?? [])
      .map((row) => row.provider_config_key)
      .filter(
        (id): id is string =>
          typeof id === "string" && Boolean(id) && !known.has(id),
      )
      .map((id) => ({ id, label: paymentIntegrationLabel(id) })),
  ];
  return correlatedJson(cid, {
    data: (data ?? []).map((row) => ({
      ...row,
      status: row.active ? "connected" : "needs_attention",
      error: row.active ? null : "Payment provider is disconnected",
    })),
    integrations,
    source: "ledger-fallback",
  });
}

export async function GET(request: Request) {
  const cid = getCorrelationId(request);
  const staff = await requireStaffApiSession("settings:read");
  if (!staff.ok) return staff.response;
  const identity = (staff.session.user?.email ?? "local-admin@localhost")
    .trim()
    .toLowerCase();
  const allowed = configuredPaymentIntegrations().map((item) => item.id);
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
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
  const apiKey = process.env.NANGO_API_KEY?.trim();
  if (!apiKey) return storedConnections(identity, organization.id, cid);
  try {
    const remote = await nangoConnections(apiKey, identity, allowed);
    const rows: PaymentNangoConnection[] = remote.map((connection) => {
      const errors = nangoErrorMessage(connection.errors);
      return {
        provider_config_key: String(connection.provider_config_key),
        nango_connection_id: String(connection.connection_id),
        provider:
          typeof connection.provider === "string" ? connection.provider : null,
        active: !errors,
        status: errors ? "needs_attention" : "connected",
        error: errors,
        updated_at: String(
          connection.updated_at ??
            connection.created ??
            new Date().toISOString(),
        ),
      };
    });
    return correlatedJson(cid, {
      data: rows,
      integrations: configuredPaymentIntegrations(),
      source: "nango",
    });
  } catch {
    return storedConnections(identity, organization.id, cid);
  }
}

async function post(request: Request) {
  const cid = getCorrelationId(request);
  const staff = await requireStaffApiSession("settings:write");
  if (!staff.ok) return staff.response;
  const membershipSup = adminSupabaseOr503(cid);
  if ("response" in membershipSup) return membershipSup.response;
  const organization = await resolveStaffOrganization(
    membershipSup.client,
    staff.session.user?.email,
  );
  if (!organization || !organizationCanManagePayments(organization.role))
    return correlatedJson(
      cid,
      { error: "Only the organization owner can manage payment connections" },
      { status: 403 },
    );
  const apiKey = process.env.NANGO_API_KEY?.trim();
  if (!apiKey)
    return correlatedJson(
      cid,
      { error: "Nango is not configured" },
      { status: 503 },
    );

  const parsed = await parseAdminJson(request, connectionSchema);
  if (!parsed.ok)
    return correlatedJson(
      cid,
      { error: parsed.error },
      { status: parsed.status },
    );
  const providerConfigKey = parsed.data.provider_config_key;
  const connectionId = parsed.data.connection_id;
  const allowed = configuredPaymentIntegrations().map((item) => item.id);
  if (!connectionId || !allowed.includes(providerConfigKey)) {
    return correlatedJson(
      cid,
      { error: "Invalid payment connection" },
      { status: 400 },
    );
  }
  if (providerConfigKey === "stripe" && !stripeAvailableForMerchant()) {
    return correlatedJson(
      cid,
      {
        error: "Stripe is not available for merchants in this country",
        code: STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
      },
      { status: 409 },
    );
  }

  const identity = (staff.session.user?.email ?? "local-admin@localhost")
    .trim()
    .toLowerCase();
  const organizationId = organization.id;
  const response = await fetch(
    `https://api.nango.dev/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(providerConfigKey)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  > & { data?: Record<string, unknown> };
  if (!response.ok) {
    return correlatedJson(
      cid,
      { error: "Unable to verify payment provider connection" },
      { status: 502 },
    );
  }
  const remote = payload.data ?? payload;
  if (String(remote.connection_id ?? connectionId) !== connectionId)
    return correlatedJson(
      cid,
      { error: "Payment provider connection could not be verified" },
      { status: 409 },
    );

  const { data, error } = await membershipSup.client
    .from("payment_nango_connections")
    .upsert(
      {
        provider_config_key: providerConfigKey,
        nango_connection_id: connectionId,
        merchant_identity: identity,
        organization_id: organizationId,
        provider: typeof remote.provider === "string" ? remote.provider : null,
        metadata: { source: "nango-connect-ui" },
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_config_key,merchant_identity" },
    )
    .select(
      "provider_config_key,nango_connection_id,provider,active,updated_at",
    )
    .single();
  if (error)
    return correlatedJson(
      cid,
      { error: "Unable to persist payment provider connection" },
      { status: 502 },
    );
  return correlatedJson(
    cid,
    { data: { ...data, status: "connected", error: null } },
    { status: 201 },
  );
}

async function deleteHandler(request: Request) {
  const cid = getCorrelationId(request);
  const staff = await requireStaffApiSession("settings:write");
  if (!staff.ok) return staff.response;
  const membershipSup = adminSupabaseOr503(cid);
  if ("response" in membershipSup) return membershipSup.response;
  const organization = await resolveStaffOrganization(
    membershipSup.client,
    staff.session.user?.email,
  );
  if (!organization || !organizationCanManagePayments(organization.role))
    return correlatedJson(
      cid,
      { error: "Only the organization owner can manage payment connections" },
      { status: 403 },
    );
  const apiKey = process.env.NANGO_API_KEY?.trim();
  if (!apiKey)
    return correlatedJson(
      cid,
      { error: "Nango is not configured" },
      { status: 503 },
    );
  const parsed = await parseAdminJson(request, disconnectSchema);
  if (!parsed.ok)
    return correlatedJson(
      cid,
      { error: parsed.error },
      { status: parsed.status },
    );
  const providerConfigKey = parsed.data.provider_config_key;
  const connectionId = parsed.data.nango_connection_id;
  const allowed = configuredPaymentIntegrations().map((item) => item.id);
  if (!connectionId || !allowed.includes(providerConfigKey))
    return correlatedJson(
      cid,
      { error: "Invalid payment connection" },
      { status: 400 },
    );
  const response = await fetch(
    `https://api.nango.dev/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(providerConfigKey)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  );
  if (!response.ok && response.status !== 404)
    return correlatedJson(
      cid,
      { error: "Unable to disconnect payment provider" },
      { status: 502 },
    );
  await membershipSup.client
    .from("payment_nango_connections")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("organization_id", organization.id)
    .eq("provider_config_key", providerConfigKey)
    .eq("nango_connection_id", connectionId);
  return correlatedJson(cid, { data: { disconnected: true } });
}

export const POST = withAdminMutationIdempotency("/admin/payments/connections:POST", post);
export const DELETE = withAdminMutationIdempotency("/admin/payments/connections:DELETE", deleteHandler);
