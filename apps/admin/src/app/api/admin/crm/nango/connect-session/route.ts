import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { z } from "zod";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { resolveStaffOrganization, organizationCanManageCrmConnections } from "@/lib/staff-organization";
import { configuredCrmIntegrations } from "@/lib/crm-nango";

const schema = z.object({ integration_id: z.string().trim().min(1).max(100) }).strict();

async function post(request: NextRequest) {
  const cid = getCorrelationId(request);
  const staff = await requireStaffApiSession("crm:write");
  if (!staff.ok) return staff.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization || !organizationCanManageCrmConnections(organization.role)) {
    return correlatedJson(cid, { error: "Only the organization owner can connect CRM providers" }, { status: 403 });
  }
  const apiKey = process.env.NANGO_API_KEY?.trim();
  if (!apiKey) return correlatedJson(cid, { error: "Nango is not configured", code: "NANGO_NOT_CONFIGURED" }, { status: 503 });
  const parsed = await parseAdminJson(request, schema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const integrationId = parsed.data.integration_id;
  if (!configuredCrmIntegrations().some((item) => item.id === integrationId)) {
    return correlatedJson(cid, { error: "CRM integration is not configured for this server" }, { status: 400 });
  }
  const identity = staff.session.user?.email?.trim().toLowerCase();
  if (!identity) return correlatedJson(cid, { error: "Authenticated owner identity is required" }, { status: 400 });
  const response = await fetch("https://api.nango.dev/connect/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      allowed_integrations: [integrationId],
      tags: { end_user_id: identity, end_user_email: identity, organization_id: organization.id, surface: "crm" },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return correlatedJson(cid, { error: "Nango Connect session creation failed" }, { status: 502 });
  return correlatedJson(cid, { data: { session_token: payload.data?.token ?? payload.token ?? null, integration_id: integrationId } });
}

export const POST = withAdminMutationIdempotency("/admin/crm/nango/connect-session:POST", post);
