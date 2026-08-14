/**
 * Guide demo catalog: static HTML under /guide-demos/.
 * Keep in sync with apps/admin/public/guide-demos/demo-runtime.js DEMO_BY_KEY.
 */
export type GuideDemoCatalogEntry = {
  key: string;
  file: string;
  title: string;
  audience: string;
  outcome: string;
  summary: string;
};

export const GUIDE_DEMO_CATALOG: readonly GuideDemoCatalogEntry[] = [
  {
    key: "dashboard",
    file: "demo-dashboard.html",
    title: "Dashboard",
    audience: "Store leads and owners",
    outcome: "See daily health signals and move into the right workspace fast.",
    summary: "Overview KPIs, sidebar groups, and a jump into Products.",
  },
  {
    key: "catalog",
    file: "demo-products.html",
    title: "Products",
    audience: "Merchandising and catalog ops",
    outcome: "Find variants quickly and keep catalog copy aligned with commerce truth.",
    summary: "Search, grid rows, and edit surface (mock data only).",
  },
  {
    key: "inventory",
    file: "demo-inventory.html",
    title: "Inventory",
    audience: "Fulfillment and stock control",
    outcome: "Confirm on-hand positions before you promise customers.",
    summary: "Stock table, refresh signal, and variant detail preview.",
  },
  {
    key: "orders",
    file: "demo-orders.html",
    title: "Orders",
    audience: "CX and fulfillment staff",
    outcome: "Prioritize paid and at-risk orders without touching live records.",
    summary: "Order list, status pills, and row focus.",
  },
  {
    key: "pos",
    file: "demo-pos.html",
    title: "POS",
    audience: "Floor staff",
    outcome: "Complete a quick in-person sale path in a safe simulator.",
    summary: "Tiles, cart lines, and pay action.",
  },
  {
    key: "offline-queue",
    file: "demo-pos-offline.html",
    title: "Offline queue",
    audience: "Managers after connectivity issues",
    outcome: "Understand how lane sales reconcile when the network returns.",
    summary: "Queued drafts versus synced receipts (illustrative).",
  },
  {
    key: "crm",
    file: "demo-crm.html",
    title: "CRM",
    audience: "Support and retention leads",
    outcome: "Review customer context before outreach.",
    summary: "Customer rows with tier and recent order timing.",
  },
  {
    key: "employees",
    file: "demo-employees.html",
    title: "Users",
    audience: "People managers",
    outcome: "See who is active and who still needs onboarding.",
    summary: "Roster, roles, and invite state.",
  },
  {
    key: "analytics",
    file: "demo-analytics.html",
    title: "Analytics",
    audience: "Owners and finance partners",
    outcome: "Compare channels and spot drift in mock performance cards.",
    summary: "Revenue mix and funnel-style callouts (not live BI).",
  },
  {
    key: "loyalty",
    file: "demo-loyalty.html",
    title: "Loyalty",
    audience: "Marketing and store leads",
    outcome: "Explain how points and rewards show up for members.",
    summary: "Program stats and top reward copy.",
  },
  {
    key: "campaigns",
    file: "demo-mkt-campaigns.html",
    title: "Campaigns",
    audience: "Growth marketers",
    outcome: "Walk through scheduled versus live sends safely.",
    summary: "Campaign list with channel and status.",
  },
  {
    key: "devices",
    file: "demo-hardware.html",
    title: "Devices",
    audience: "IT and operations",
    outcome: "Check register and peripheral health before opening hours.",
    summary: "Hardware list with online and warning states.",
  },
  {
    key: "channels",
    file: "demo-channels.html",
    title: "Channels",
    audience: "Operations leads",
    outcome: "Relate web, POS, and intake volume in one glance.",
    summary: "Event counts and error flags per channel.",
  },
  {
    key: "chat-orders",
    file: "demo-chat-orders.html",
    title: "Chat orders",
    audience: "Social and concierge teams",
    outcome: "Triage manual intake threads without a live inbox.",
    summary: "Threads with intent and reply state.",
  },
  {
    key: "storefront",
    file: "demo-storefront.html",
    title: "Homepage content",
    audience: "Brand and ecommerce leads",
    outcome: "Preview how homepage payload edits are staged (mock).",
    summary: "Hero modules and publish bar (illustrative).",
  },
  {
    key: "cms",
    file: "demo-cms.html",
    title: "Content",
    audience: "Editorial staff",
    outcome: "Separate website work from commerce records.",
    summary: "Content hub list and editor preview.",
  },
  {
    key: "reviews",
    file: "demo-product-reviews.html",
    title: "Reviews",
    audience: "Trust and safety leads",
    outcome: "Moderate customer voice before it appears publicly.",
    summary: "Pending and flagged rows with excerpts.",
  },
  {
    key: "payments",
    file: "demo-payments.html",
    title: "Payments",
    audience: "Finance and admins",
    outcome: "Orient teams to provider and region configuration (read-only story).",
    summary: "Provider chips and region line (mock).",
  },
] as const;

export const GUIDE_DEMO_CATALOG_BY_KEY: Readonly<Record<string, GuideDemoCatalogEntry>> =
  GUIDE_DEMO_CATALOG.reduce(
    (acc, row) => {
      acc[row.key] = row;
      return acc;
    },
    {} as Record<string, GuideDemoCatalogEntry>,
  );
