import { fetchMedusaPaymentProvidersFromRegions } from "@/lib/payment-providers-bridge";
import { logAdminApiEvent } from "@/lib/admin-api-log";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";

export async function GET(req: Request) {
  const correlationId = getCorrelationId(req);
  const staff = await requireStaffApiSession("settings:read");
  if (!staff.ok) {
    return tagResponse(staff.response, correlationId);
  }

  const sup = adminSupabaseOr503(correlationId);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedJson(correlationId, { error: "Organization membership is not configured" }, { status: 403 });

  let providers;
  try {
    providers = await fetchMedusaPaymentProvidersFromRegions();
  } catch {
    return correlatedJson(correlationId, { error: "Unable to load payment providers" }, { status: 502 });
  }

  logAdminApiEvent({
    route: "GET /api/admin/medusa/payment-providers",
    correlationId,
    phase: "ok",
    detail: { count: providers.length },
  });

  return correlatedJson(correlationId, {
    providers,
    installmentNote:
      "Installment and BNPL depend on your payment provider module (for example Stripe, PayMongo) and region configuration in Admin.",
  });
}
