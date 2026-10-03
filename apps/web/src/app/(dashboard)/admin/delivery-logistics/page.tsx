import { LogisticsWorkspace } from "@/components/LogisticsWorkspace";
import { AdminPageShell } from "@/components/admin-console";
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
  let shipments: ReturnType<typeof normalizeDeliveryLogisticsShipmentRow>[] = [];
  let events: ReturnType<typeof normalizeDeliveryLogisticsEventRow>[] = [];
  let errorMessage: string | null = null;

  try {
    const response = await fetchWorkerDeliveryShipmentsForAdmin();
    if (!response?.ok) throw new Error("Delivery data service unavailable");
    const payload = await readResponseJson<unknown>(response, null);
    const parsed = adminDeliveryShipmentResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Delivery data response is invalid");
    shipments = parsed.data.data.shipments.map(normalizeDeliveryLogisticsShipmentRow);
    events = parsed.data.data.events.map(normalizeDeliveryLogisticsEventRow);
  } catch {
    errorMessage = "Delivery data is temporarily unavailable. Shipment data will appear when the commerce service is back.";
  }

  return (
    <AdminPageShell
      title="Delivery logistics"
      subtitle="Monitor shipment progress, exceptions, and courier handoffs."
    >{errorMessage ? (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          {errorMessage}
        </div>
      ) : null}
      <LogisticsWorkspace shipments={shipments} events={events} />
    </AdminPageShell>
  );
}
