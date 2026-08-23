import { LogisticsWorkspace } from "@/components/LogisticsWorkspace";
import { getDeliveryLogisticsOverview } from "@/lib/delivery-logistics";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export const dynamic = "force-dynamic";

export default async function DeliveryLogisticsPage() {
  await requirePagePermission("dashboard:read");
  const session = await getServerSession(authOptions);
  const sup = adminSupabaseOr503("delivery-logistics-page");
  if ("response" in sup) throw new Error("Admin data service unavailable");
  const organization = await resolveStaffOrganization(sup.client, session?.user?.email);
  if (!organization) throw new Error("Organization membership is not configured");
  const overview = await getDeliveryLogisticsOverview(organization.id);

  return <LogisticsWorkspace shipments={overview.shipments} events={overview.events} />;
}
