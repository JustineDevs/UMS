import { LogisticsWorkspace } from "@/components/LogisticsWorkspace";
import { getDeliveryLogisticsOverview } from "@/lib/delivery-logistics";
import { requirePagePermission } from "@/lib/require-page-permission";

export const dynamic = "force-dynamic";

export default async function DeliveryLogisticsPage() {
  await requirePagePermission("dashboard:read");
  const overview = await getDeliveryLogisticsOverview();

  return <LogisticsWorkspace shipments={overview.shipments} events={overview.events} />;
}
