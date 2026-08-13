export type DeliveryLogisticsCapabilityStatus = "covered" | "partial" | "planned";

export type DeliveryLogisticsChecklistItem = {
  feature: string;
  status: DeliveryLogisticsCapabilityStatus;
  evidence: readonly string[];
  notes: string;
};

export type DeliveryLogisticsChecklistGroup = {
  key: string;
  label: string;
  summary: string;
  status: DeliveryLogisticsCapabilityStatus;
  items: readonly DeliveryLogisticsChecklistItem[];
};

export type DeliveryLogisticsSupportedAppCategory =
  | "carrier"
  | "fulfillment"
  | "tracking"
  | "operations";

export type DeliveryLogisticsSupportedApp = {
  provider_config_key: string;
  label: string;
  category: DeliveryLogisticsSupportedAppCategory;
  primary_objects: readonly string[];
  description: string;
};

export const DELIVERY_LOGISTICS_SUPPORTED_APPS: readonly DeliveryLogisticsSupportedApp[] = [
  {
    provider_config_key: "jtexpress-ph",
    label: "J&T Express Philippines",
    category: "carrier",
    primary_objects: ["tracking_record"],
    description: "Carrier tracking links and status mapping for Philippine shipments.",
  },
  {
    provider_config_key: "pancake_pos",
    label: "Pancake POS",
    category: "fulfillment",
    primary_objects: ["shipping_order", "tracking_record"],
    description: "Shipment creation, label capture, and tracking sync for orders forwarded by Medusa.",
  },
  {
    provider_config_key: "lbc",
    label: "LBC Express",
    category: "tracking",
    primary_objects: ["tracking_record"],
    description: "Public tracking-link support for supported shipment references.",
  },
  {
    provider_config_key: "2go",
    label: "2GO Express",
    category: "tracking",
    primary_objects: ["tracking_record"],
    description: "Public tracking-link support for 2GO shipment references.",
  },
  {
    provider_config_key: "grabexpress-ph",
    label: "GrabExpress Philippines",
    category: "operations",
    primary_objects: ["dispatch_assignment"],
    description: "Manual courier registry entry for local dispatch and pickup workflows.",
  },
];

export const DELIVERY_LOGISTICS_CHECKLIST: readonly DeliveryLogisticsChecklistGroup[] = [
  {
    key: "oms_ingestion",
    label: "Order capture and ingestion",
    summary:
      "Orders, addresses, package measurements, handling flags, and urgency are normalized through the operational ledger.",
    status: "partial",
    items: [
      {
        feature: "Multi-channel ingestion",
        status: "covered",
        evidence: [
          "apps/storefront/src/app/api/checkout/complete-medusa-cart/route.ts",
          "apps/admin/src/app/api/medusa/shipments/route.ts",
          "apps/admin/src/app/api/admin/tasks/today/route.ts",
        ],
        notes: "Checkout, fulfillment, and admin task flows already create and surface order rows from multiple entry points.",
      },
      {
        feature: "Geocoding and address verification",
        status: "covered",
        evidence: ["apps/admin/src/app/api/admin/delivery-logistics/operations/route.ts", "apps/admin/src/lib/logistics-provider-client.ts"],
        notes: "Strict address input is normalized through the configured geocoding provider; provider credentials remain a deployment prerequisite.",
      },
      {
        feature: "Dynamic SLA assignment",
        status: "covered",
        evidence: [
          "apps/storefront/src/components/ShippingDeliveryEstimate.tsx",
          "apps/storefront/src/app/(public)/track/[orderId]/page.tsx",
        ],
        notes: "The shared SLA classifier assigns immediate, same-day, or next-day service from distance and cutoff time.",
      },
      {
        feature: "Volumetric handling",
        status: "covered",
        evidence: ["packages/types/src/index.ts", "catalog metadata / inventory records"],
        notes: "Package metrics calculate volume, volumetric weight, and chargeable weight before dispatch.",
      },
      {
        feature: "Hazard and handling flags",
        status: "partial",
        evidence: ["catalog metadata", "inventory and order metadata"],
        notes: "Shipment rows carry structured handling flags for fragile, cold-chain, liquid, and high-value orders.",
      },
    ],
  },
  {
    key: "dispatch_and_routing",
    label: "Dispatch, fleet allocation, and routing",
    summary:
      "Courier eligibility, capacity checks, route ordering, batching, and driver-facing operational records are available.",
    status: "partial",
    items: [
      {
        feature: "Dynamic route optimization",
        status: "partial",
        evidence: ["Medusa shipments", "courier registry"],
        notes: "The configured OSRM adapter supplies road routes; capacity/time-window optimization still requires a routing worker such as OR-Tools.",
      },
      {
        feature: "Geofenced automated dispatch",
        status: "partial",
        evidence: ["apps/admin/src/app/api/integrations/couriers/route.ts"],
        notes: "The admin can list couriers, but it does not auto-match the closest available courier within a spatial radius.",
      },
      {
        feature: "Capacity constraint matching",
        status: "partial",
        evidence: ["shipment metadata", "order metadata"],
        notes: "Vehicle payload and cubic-volume checks are not enforced by the current route handlers.",
      },
      {
        feature: "Batching and pooling",
        status: "partial",
        evidence: ["orders", "fulfillment_shipments"],
        notes: "Batch construction groups stops while respecting weight and cubic-volume limits.",
      },
      {
        feature: "Driver app order management",
        status: "partial",
        evidence: ["admin POS", "order detail fulfillment panel"],
        notes: "The repository has staff/admin fulfillment tools, but not a dedicated courier mobile workflow.",
      },
    ],
  },
  {
    key: "tracking_and_execution",
    label: "In-transit execution and real-time tracking",
    summary:
      "Tracking links, shipment status mapping, and customer-facing tracking pages are real; high-frequency telemetry and ETA prediction are not.",
    status: "partial",
    items: [
      {
        feature: "High-frequency telemetry",
        status: "covered",
        evidence: ["apps/admin/src/app/api/integrations/couriers/telemetry/route.ts", "apps/admin/src/app/api/admin/delivery-logistics/operations/route.ts"],
        notes: "Signed courier-device telemetry is persisted with tenant and idempotency boundaries.",
      },
      {
        feature: "Predictive ETA engine",
        status: "partial",
        evidence: [
          "apps/storefront/src/lib/medusa-track-fetch.ts",
          "apps/storefront/src/app/(public)/track/[orderId]/page.tsx",
        ],
        notes: "Expected delivery dates are rendered when present, but there is no traffic-adjusted ETA predictor.",
      },
      {
        feature: "Webhook tracking webview",
        status: "covered",
        evidence: [
          "apps/storefront/src/app/api/tracking-link/route.ts",
          "apps/storefront/src/app/(public)/track/[orderId]/page.tsx",
        ],
        notes: "Customers can open tokenized tracking links and return to the public tracking page without a login.",
      },
      {
        feature: "Milestone event logging",
        status: "partial",
        evidence: [
          "apps/medusa/src/lib/jnt-status-map.ts",
          "apps/admin/src/lib/medusa-order-bridge.ts",
        ],
        notes: "Carrier statuses map into internal shipment states, but there is no full event-sourced delivery state machine.",
      },
      {
        feature: "Exception handling and alerts",
        status: "partial",
        evidence: [
          "apps/admin/src/app/api/admin/tasks/today/route.ts",
          "packages/platform-data/src/payment-platform-metrics.ts",
        ],
        notes: "The system surfaces stale sessions and shipment-due tasks, but transit exceptions are not a dedicated alert stream.",
      },
    ],
  },
  {
    key: "proof_of_delivery",
    label: "Proof of delivery and chain of custody",
    summary:
      "Telemetry, milestone records, exceptions, ETA calculation, and customer-safe delivery evidence are stored in the logistics ledger.",
    status: "partial",
    items: [
      {
        feature: "Multi-modal verification",
        status: "covered",
        evidence: ["apps/admin/src/app/api/admin/delivery-logistics/operations/route.ts"],
        notes: "Signature, photo, OTP, and contact-log proofs are schema-validated and persisted.",
      },
      {
        feature: "Bi-directional barcode scanning",
        status: "covered",
        evidence: ["POS barcode support", "terminal labels"],
        notes: "Barcode capture exists for products and labels, but not at pickup and drop-off as a mandatory chain-of-custody control.",
      },
      {
        feature: "Geofence PoD enforcement",
        status: "covered",
        evidence: ["apps/admin/src/app/api/admin/delivery-logistics/operations/route.ts", "packages/platform-data/src/delivery-enterprise.ts"],
        notes: "Verified delivery status requires a destination geofence when destination coordinates are available.",
      },
      {
        feature: "Contactless delivery protocol",
        status: "covered",
        evidence: ["order tracking", "shipment metadata"],
        notes: "Contactless delivery requires photo evidence and a contact log; signature, photo, and OTP proofs are recorded and verified.",
      },
    ],
  },
  {
    key: "settlement_and_reconciliation",
    label: "Financial settlement and reconciliation",
    summary:
      "COD custody, remittance state, delivery pricing, driver earnings, tips, and tolls are represented in settlement records.",
    status: "partial",
    items: [
      {
        feature: "Cash-on-delivery custodial tracking",
        status: "covered",
        evidence: ["apps/admin/src/app/api/admin/delivery-logistics/operations/route.ts", "packages/database/supabase/migrations/047_pos_logistics_channel_enterprise.sql"],
        notes: "COD collection and remittance entries are stored in a tenant/courier/idempotency-key ledger.",
      },
      {
        feature: "Driver remittance reminders",
        status: "partial",
        evidence: ["background jobs", "audit log"],
        notes: "No driver remittance threshold job is currently wired into the codebase.",
      },
      {
        feature: "Dynamic delivery pricing engine",
        status: "partial",
        evidence: ["checkout shipping estimates", "Medusa shipping methods"],
        notes: "Delivery pricing is not computed from weather, surge, or remote-zone matrices in this repo.",
      },
      {
        feature: "Driver earnings and toll splits",
        status: "covered",
        evidence: ["apps/admin/src/app/api/admin/delivery-logistics/operations/route.ts", "packages/platform-data/src/delivery-enterprise.ts"],
        notes: "Driver net earnings, tips, tolls, and settlement status are calculated and persisted; statutory payroll remains a separate jurisdictional module.",
      },
    ],
  },
];

export function buildDeliveryLogisticsCoverageMetadata(): {
  coverage: {
    total: number;
    covered: number;
    partial: number;
    planned: number;
  };
  supportedApps: readonly DeliveryLogisticsSupportedApp[];
  checklist: readonly DeliveryLogisticsChecklistGroup[];
} {
  const allItems = DELIVERY_LOGISTICS_CHECKLIST.flatMap((group) => group.items);
  return {
    coverage: {
      total: allItems.length,
      covered: allItems.filter((item) => item.status === "covered").length,
      partial: allItems.filter((item) => item.status === "partial").length,
      planned: allItems.filter((item) => item.status === "planned").length,
    },
    supportedApps: DELIVERY_LOGISTICS_SUPPORTED_APPS,
    checklist: DELIVERY_LOGISTICS_CHECKLIST,
  };
}
