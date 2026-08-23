import {
  buildDeliveryLogisticsCoverageMetadata,
  listDeliveryLogisticsEvents,
  listDeliveryLogisticsShipments,
  type DeliveryLogisticsChecklistGroup,
  type DeliveryLogisticsEventRow,
  type DeliveryLogisticsSupportedApp,
  type DeliveryLogisticsShipmentRow,
} from "@universal-music-store/platform-data";
import { COURIER_REGISTRY, type CourierDefinition } from "@/lib/courier-registry";
import { fetchMedusaOrdersForAdmin } from "@/lib/medusa-order-bridge";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getPaymentPlatformMetrics } from "@universal-music-store/platform-data";

export type DeliveryLogisticsOverview = {
  coverage: {
    total: number;
    covered: number;
    partial: number;
    planned: number;
  };
  checklist: readonly DeliveryLogisticsChecklistGroup[];
  supportedApps: readonly DeliveryLogisticsSupportedApp[];
  couriers: readonly CourierDefinition[];
  shipments: readonly DeliveryLogisticsShipmentRow[];
  events: readonly DeliveryLogisticsEventRow[];
  operationalSignals: {
    activeOrders: number;
    shipmentDue: number;
    recordedShipments: number;
    recentEvents: number;
    trackingLinksEnabled: boolean;
    codDeliveredPendingCapture: number;
    pancakePosConfigured: boolean;
    smsConfigured: boolean;
  };
};

export async function getDeliveryLogisticsOverview(organizationId: string): Promise<DeliveryLogisticsOverview> {
  const coverage = buildDeliveryLogisticsCoverageMetadata();
  const [ordersResult, sup] = await Promise.all([
    fetchMedusaOrdersForAdmin(100),
    Promise.resolve(adminSupabaseOr503("delivery-logistics")),
  ]);

  const activeOrders = ordersResult.orders.filter((order) =>
    ["paid", "ready_to_ship", "shipped"].includes(order.status),
  ).length;
  const shipmentDue = ordersResult.orders.filter((order) =>
    ["paid", "ready_to_ship"].includes(order.status),
  ).length;

  const metrics = "client" in sup ? await getPaymentPlatformMetrics(sup.client) : null;
  const [shipments, events] =
    "client" in sup
      ? await Promise.all([
          listDeliveryLogisticsShipments(sup.client, { limit: 25, organizationId }),
          listDeliveryLogisticsEvents(sup.client, { limit: 25, organizationId }),
        ])
      : [[], []];

  return {
    coverage: coverage.coverage,
    checklist: coverage.checklist,
    supportedApps: coverage.supportedApps,
    couriers: COURIER_REGISTRY,
    shipments,
    events,
    operationalSignals: {
      activeOrders,
      shipmentDue,
      recordedShipments: shipments.length,
      recentEvents: events.length,
      trackingLinksEnabled: Boolean(process.env.TRACKING_HMAC_SECRET?.trim()),
      codDeliveredPendingCapture: metrics?.codDeliveredPendingCapture ?? 0,
      pancakePosConfigured: Boolean(
        process.env.PANCAKE_POS_API_KEY?.trim() || process.env.PANCAKE_API_KEY?.trim(),
      ),
      smsConfigured: Boolean(process.env.SEMAPHORE_API_KEY?.trim()),
    },
  };
}
