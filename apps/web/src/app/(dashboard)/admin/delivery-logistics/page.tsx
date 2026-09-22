import { LogisticsWorkspace } from "@/components/LogisticsWorkspace";
import { requirePagePermission } from "@/lib/require-page-permission";
import { fetchWorkerDeliveryShipmentsForAdmin } from "@/lib/worker-admin-bridge";
import { readResponseJson } from "@/lib/read-response-json";
import { adminDeliveryShipmentResponseSchema } from "@/lib/admin-api-contracts";
import {
  normalizeDeliveryLogisticsEventRow,
  normalizeDeliveryLogisticsShipmentRow,
} from "@universal-music-store/platform-data";

export const dynamic = "force-dynamic";

export default async function DeliveryLogisticsPage() {
  await requirePagePermission("dashboard:read");
  const response = await fetchWorkerDeliveryShipmentsForAdmin();
  if (!response?.ok) throw new Error("Delivery data service unavailable");
  const payload = await readResponseJson<unknown>(response, null);
  const parsed = adminDeliveryShipmentResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Delivery data response is invalid");
  const shipments = parsed.data.data.shipments.map(normalizeDeliveryLogisticsShipmentRow);
  const events = parsed.data.data.events.map(normalizeDeliveryLogisticsEventRow);

  return <LogisticsWorkspace shipments={shipments} events={events} />;
}
