import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getDeliveryLogisticsOverview } from "@/lib/delivery-logistics";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError } from "@/lib/staff-api-response";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("dashboard:read");
  if (!staff.ok) return staff.response;
  const sup = adminSupabaseOr503("delivery-logistics");
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, staff.session.user?.email);
  if (!organization) return correlatedError(correlationId, 403, "Organization membership is not configured", "FORBIDDEN");
  const overview = await getDeliveryLogisticsOverview(organization.id);
  return NextResponse.json({
    ok: true,
    overview,
  });
}
