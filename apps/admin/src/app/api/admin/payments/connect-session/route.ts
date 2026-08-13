import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";
import { configuredPaymentIntegrations } from "@/lib/payment-nango";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import {
  resolveStaffOrganization,
  organizationCanManagePayments,
} from "@/lib/staff-organization";
import {
  stripeAvailableForMerchant,
  STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
} from "@/lib/payment-country-policy";

const connectSessionSchema = z
  .object({
    integration_id: z.string().trim().min(1).max(100),
  })
  .strict();

/** Creates a Nango Connect session; provider credentials never pass through this API. */
async function post(request: NextRequest) {
  const cid = getCorrelationId(request);
  const access = await requireStaffApiSession("settings:write");
  if (!access.ok) return access.response;
  const session = access.session;
  const membershipSup = adminSupabaseOr503(cid);
  if ("response" in membershipSup) return membershipSup.response;
  const organization = await resolveStaffOrganization(
    membershipSup.client,
    session.user?.email,
  );
  if (!organization || !organizationCanManagePayments(organization.role))
    return correlatedJson(
      cid,
      { error: "Only the organization owner can connect payment providers" },
      { status: 403 },
    );
  const apiKey = process.env.NANGO_API_KEY?.trim();
  if (!apiKey)
    return correlatedJson(
      cid,
      { error: "Nango is not configured", code: "NANGO_NOT_CONFIGURED" },
      { status: 503 },
    );

  const parsed = await parseAdminJson(request, connectSessionSchema);
  if (!parsed.ok)
    return correlatedJson(
      cid,
      { error: parsed.error },
      { status: parsed.status },
    );
  const integrationId = parsed.data.integration_id;
  const allowed = configuredPaymentIntegrations().map((item) => item.id);
  if (!integrationId || !allowed.includes(integrationId)) {
    return correlatedJson(
      cid,
      { error: "integration_id must be one of NANGO_PAYMENT_INTEGRATIONS" },
      { status: 400 },
    );
  }
  if (integrationId === "stripe" && !stripeAvailableForMerchant()) {
    return correlatedJson(
      cid,
      {
        error: "Stripe is not available for merchants in this country",
        code: STRIPE_UNAVAILABLE_IN_MERCHANT_COUNTRY,
      },
      { status: 409 },
    );
  }

  const endUserId = session.user.email?.trim().toLowerCase();
  if (!endUserId)
    return correlatedJson(
      cid,
      { error: "Authenticated merchant identity is required" },
      { status: 400 },
    );
  const organizationId = organization.id;
  const response = await fetch("https://api.nango.dev/connect/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      allowed_integrations: [integrationId],
      tags: {
        end_user_id: endUserId,
        end_user_email: session.user.email ?? endUserId,
        organization_id: organizationId,
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    return correlatedJson(
      cid,
      { error: "Nango Connect session creation failed", detail: payload },
      { status: 502 },
    );
  return correlatedJson(cid, {
    data: {
      session_token: payload.data?.token ?? payload.token ?? null,
      integration_id: integrationId,
    },
  });
}

export const POST = withAdminMutationIdempotency("/admin/payments/connect-session:POST", post);
