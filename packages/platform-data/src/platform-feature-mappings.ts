export type PlatformFeatureStatus = "implemented" | "partial" | "planned";

export type PlatformFeatureDomain =
  | "pos"
  | "logistics"
  | "multi_channel"
  | "crm"
  | "support"
  | "integrations"
  | "payroll_remittance";

export type PlatformFeatureMapping = {
  key: string;
  domain: PlatformFeatureDomain;
  label: string;
  status: PlatformFeatureStatus;
  systemOfRecord: string;
  adminSurfaces: readonly string[];
  storefrontSurfaces: readonly string[];
  apiSurfaces: readonly string[];
  dataFlow: readonly string[];
  ossOrProvider: readonly {
    name: string;
    role: string;
    url: string;
  }[];
  notes: string;
};

/** The integration contract for each cross-application capability. */
export const PLATFORM_FEATURE_MAPPINGS: readonly PlatformFeatureMapping[] = [
  {
    key: "pos.sale_to_commerce",
    domain: "pos",
    label: "POS sale, shift, receipt, and inventory flow",
    status: "implemented",
    systemOfRecord: "Medusa orders and inventory; Supabase staff, shift, device, and audit records",
    adminSurfaces: ["/admin/pos", "/admin/orders", "/admin/inventory", "/admin/receipts"],
    storefrontSurfaces: ["/checkout", "/account/orders"],
    apiSurfaces: ["/api/pos/medusa/commit-sale", "/api/admin/pos/enterprise", "/api/admin/shifts", "/api/admin/pos/feature-mappings"],
    dataFlow: [
      "staff session -> shift/device authorization -> commit-sale",
      "commit-sale -> Medusa order -> inventory reservation",
      "sale metadata -> receipt and CRM attribution",
    ],
    ossOrProvider: [
      { name: "node-escpos/driver", role: "ESC/POS printer and cash-drawer device abstraction", url: "https://github.com/node-escpos/driver" },
      { name: "Medusa", role: "commerce orders, inventory, and sales-channel ownership", url: "https://medusajs.com/sales-channel-module/" },
    ],
    notes: "Sale idempotency, certified hardware/payment-terminal registry, fiscal profile validation, and persisted cashier reconciliation sourced from shift-tagged Medusa sales and POS voids are implemented. Authority certification and provider approval remain deployment evidence requirements.",
  },
  {
    key: "logistics.delivery_execution",
    domain: "logistics",
    label: "Delivery OMS, dispatch, tracking, proof, and settlement",
    status: "implemented",
    systemOfRecord: "Supabase delivery logistics ledger with Medusa shipment references",
    adminSurfaces: ["/admin/delivery-logistics", "/admin/orders"],
    storefrontSurfaces: ["/track/[orderId]", "/checkout"],
    apiSurfaces: ["/api/admin/delivery-logistics/operations", "/api/admin/delivery-logistics/shipments", "/api/tracking-link"],
    dataFlow: [
      "Medusa order -> shipment ledger -> courier/telemetry/proof events",
      "shipment state -> customer-safe tracking page",
      "proof and COD settlement -> immutable operational audit trail",
    ],
    ossOrProvider: [
      { name: "OSRM", role: "route geometry and travel-time/distance matrices", url: "https://project-osrm.org/docs/" },
      { name: "Google OR-Tools", role: "capacity/time-window vehicle-routing optimization", url: "https://developers.google.com/optimization/routing" },
    ],
    notes: "Persisted courier telemetry with idempotency, destination geofence proof, route request contracts, courier cash/earnings ledger tables, and settlement validation are implemented. OSRM/geocoder/driver-device credentials remain deployment inputs.",
  },
  {
    key: "multi_channel.sales_channel",
    domain: "multi_channel",
    label: "Storefront, POS, marketplace, and integration channel context",
    status: "implemented",
    systemOfRecord: "Medusa sales channels and order/inventory records",
    adminSurfaces: ["/admin/channels", "/admin/pos", "/admin/orders", "/admin/settings/payments"],
    storefrontSurfaces: ["/", "/shop", "/checkout"],
    apiSurfaces: ["/api/integrations/channels/webhook", "/api/checkout/complete-medusa-cart"],
    dataFlow: [
      "channel identity -> catalog/price/stock availability",
      "channel order -> Medusa order -> fulfillment and analytics",
      "external webhook -> signature verification -> normalized channel event",
    ],
    ossOrProvider: [
      { name: "Medusa Sales Channels", role: "channel-aware products, prices, inventory, orders, and customers", url: "https://medusajs.com/sales-channel-module/" },
      { name: "Vendure Channels", role: "reference architecture for channel-scoped commerce entities", url: "https://docs.vendure.io/current/core/core-concepts/channels" },
    ],
    notes: "Medusa remains the commerce system of record. Tenant-bound webhook signatures, nonce replay protection, payload hashing, and allow-listed channel authorization are implemented; each integration must sign the tenant-bound canonical payload.",
  },
  {
    key: "crm.nango_connections",
    domain: "crm",
    label: "CRM records and OAuth-backed connections",
    status: "partial",
    systemOfRecord: "Supabase integration mappings; connected CRM remains the external record owner",
    adminSurfaces: ["/admin/crm", "/admin/settings/integrations"],
    storefrontSurfaces: ["/account", "/checkout"],
    apiSurfaces: ["/api/admin/crm", "/api/webhooks/nango"],
    dataFlow: [
      "Nango connection -> transient provider token -> scoped CRM operation",
      "commerce/customer event -> normalized mapping -> external CRM record",
    ],
    ossOrProvider: [
      { name: "Nango", role: "OAuth, token refresh, credential isolation, scopes, retries, and provider connectivity", url: "https://nango.dev/docs/getting-started/intro-to-nango" },
      { name: "Twenty", role: "optional self-hosted CRM destination", url: "https://github.com/twentyhq/twenty" },
    ],
    notes: "Nango is an integration control plane, not the CRM database. Native sync coverage and provider-specific field mappings are still incomplete.",
  },
  {
    key: "integrations.oauth_control_plane",
    domain: "integrations",
    label: "OAuth and provider credential lifecycle",
    status: "partial",
    systemOfRecord: "Nango connection state and provider-owned credentials",
    adminSurfaces: ["/admin/settings/integrations", "/admin/channels"],
    storefrontSurfaces: [],
    apiSurfaces: ["/api/webhooks/nango"],
    dataFlow: [
      "admin connection intent -> Nango OAuth flow",
      "Nango webhook -> connection status and scoped mapping state",
    ],
    ossOrProvider: [
      { name: "Nango", role: "credential vault, token refresh, scopes, retries, and provider isolation", url: "https://nango.dev/docs/getting-started/intro-to-nango" },
    ],
    notes: "Nango is integrated for connection metadata and webhook handling; every provider action still requires explicit route scope and tenant authorization.",
  },
  {
    key: "support.omnichannel_inbox",
    domain: "support",
    label: "Customer support and chat-order intake",
    status: "partial",
    systemOfRecord: "Internal channel event bridge; external support inbox when connected",
    adminSurfaces: ["/admin/channels", "/admin/chat-orders", "/admin/crm"],
    storefrontSurfaces: ["/support", "/account"],
    apiSurfaces: ["/api/integrations/channels/webhook", "/api/integrations/chat-orders/intake"],
    dataFlow: [
      "signed inbound message -> normalized channel event -> support/order workflow",
      "agent action -> scoped commerce mutation -> customer notification",
    ],
    ossOrProvider: [
      { name: "Chatwoot", role: "optional self-hosted omnichannel support inbox", url: "https://github.com/chatwoot/chatwoot" },
      { name: "Nango", role: "provider authentication and connection lifecycle", url: "https://nango.dev/docs/getting-started/intro-to-nango" },
    ],
    notes: "The internal bridge exists, but a production support inbox needs a chosen external system, signed inbound events, replay windows, and agent-level authorization.",
  },
  {
    key: "payroll_remittance.compliance",
    domain: "payroll_remittance",
    label: "Payroll and remittance",
    status: "planned",
    systemOfRecord: "Not implemented; jurisdiction-specific source of truth must be selected",
    adminSurfaces: ["/admin/users", "/admin/settings"],
    storefrontSurfaces: [],
    apiSurfaces: [],
    dataFlow: [],
    ossOrProvider: [],
    notes: "No gross-to-net, statutory deduction, bank-file, cross-border remittance, or government filing engine was found. This cannot be marked real without a jurisdiction and licensed/payment-provider design.",
  },
];

export function buildPlatformFeatureMappingMetadata() {
  const total = PLATFORM_FEATURE_MAPPINGS.length;
  return {
    mappings: PLATFORM_FEATURE_MAPPINGS,
    coverage: {
      total,
      implemented: PLATFORM_FEATURE_MAPPINGS.filter((mapping) => mapping.status === "implemented").length,
      partial: PLATFORM_FEATURE_MAPPINGS.filter((mapping) => mapping.status === "partial").length,
      planned: PLATFORM_FEATURE_MAPPINGS.filter((mapping) => mapping.status === "planned").length,
    },
  };
}

export function buildPublicPlatformFeatureMappingMetadata() {
  return PLATFORM_FEATURE_MAPPINGS.map(({ key, domain, label, status, storefrontSurfaces, ossOrProvider, notes }) => ({
    key,
    domain,
    label,
    status,
    storefrontSurfaces,
    ossOrProvider,
    notes,
  }));
}
