/**
 * Medusa vs Supabase (legacy) boundaries for this monorepo.
 *
 * - **Medusa Postgres** (`apps/medusa` `DATABASE_URL`): authoritative commerce — catalog, cart, order,
 *   payment sessions/collections, inventory, regions, Medusa customers, fulfillments.
 * - **Supabase** (`LEGACY_DATABASE_URL`): platform only — staff identity/RBAC, CMS, audit, POS ops,
 *   bridges (`medusa_*` reference columns), analytics events — **not** a second commerce catalog or order store.
 *
 * Do not add legacy tables that duplicate Medusa first-class entities. See `check-commerce-migration-boundary.mjs`.
 * If a legacy database ever contained mistaken copies of Medusa `public` tables (same names as
 * `internal/docs/exclusive/medusadb/schema.sql`), migration `015_drop_accidental_medusa_core_tables_from_legacy.sql`
 * drops them when applied via `LEGACY_DATABASE_URL` only.
 */

/** Commerce domains owned solely by Medusa (not recreated in Supabase). */
export const MEDUSA_COMMERCE_DOMAINS = [
  "product_catalog",
  "variant_pricing",
  "cart_checkout",
  "order_payment_fulfillment",
  "inventory_stock_locations",
  "medusa_customer_record",
  "promotions_pricing_engine",
] as const;

export type AppSurface = "storefront" | "admin" | "api" | "internal";

export type LegacyTableKind = "platform" | "bridge" | "derived";

export type LegacyTableBinding = {
  surfaces: AppSurface[];
  kind: LegacyTableKind;
  notes: string;
};

/**
 * Primary wiring: which app surfaces touch each legacy table. Medusa tables are not listed here.
 * Used for navigation and reviews; commerce reads/writes go through Medusa SDK or Medusa DB.
 */
export const LEGACY_TABLE_BINDINGS: Record<string, LegacyTableBinding> = {
  users: {
    surfaces: ["admin", "api", "storefront"],
    kind: "platform",
    notes: "OAuth identities for staff; not the Medusa storefront customer of record.",
  },
  staff_permission_grants: {
    surfaces: ["admin", "api"],
    kind: "platform",
    notes: "RBAC; Medusa has no parallel staff table.",
  },
  audit_logs: {
    surfaces: ["admin", "api"],
    kind: "platform",
    notes: "Staff audit trail; may reference Medusa ids in details only.",
  },
  product_reviews: {
    surfaces: ["storefront", "admin"],
    kind: "bridge",
    notes: "UGC only; keyed by medusa_product_id + slug; not a second product catalog.",
  },
  storefront_customer_profiles: {
    surfaces: ["storefront"],
    kind: "platform",
    notes:
      "Optional saved display name, phone, and shipping address book keyed by sign-in email; Medusa remains customer and order SoR.",
  },
  product_qa_entries: {
    surfaces: ["storefront", "admin"],
    kind: "platform",
    notes:
      "Curated Q&A per product slug; public read for approved rows only; not duplicate catalog data.",
  },
  cart_abandonment_events: {
    surfaces: ["storefront", "api"],
    kind: "derived",
    notes:
      "Analytics stream only; authoritative cart is Medusa. Optional recovery_email_sent_at when Resend-backed nudge sends.",
  },
  loyalty_accounts: {
    surfaces: ["storefront", "admin", "api"],
    kind: "bridge",
    notes: "Ledger keyed by medusa_customer_id; balances are not duplicated on Medusa order lines as SoR.",
  },
  loyalty_transactions: {
    surfaces: ["admin", "api"],
    kind: "bridge",
    notes: "References medusa_order_id; not parallel order storage.",
  },
  campaigns: {
    surfaces: ["admin", "api"],
    kind: "platform",
    notes: "Audience/messaging; cart totals and discounts at checkout remain Medusa.",
  },
  storefront_home_content: {
    surfaces: ["storefront", "admin"],
    kind: "platform",
    notes: "CMS; product tiles resolve to Medusa-backed URLs.",
  },
  storefront_public_metadata: {
    surfaces: ["storefront", "admin"],
    kind: "platform",
    notes: "Public site copy; no product rows.",
  },
  pos_devices: {
    surfaces: ["admin", "api"],
    kind: "platform",
    notes: "Device registry; sales reconcile to Medusa.",
  },
  offline_pos_queue: {
    surfaces: ["admin", "api"],
    kind: "platform",
    notes: "Offline queue metadata; committed sales are Medusa orders.",
  },
  payment_attempts: {
    surfaces: ["storefront", "admin"],
    kind: "bridge",
    notes:
      "Operational checkout/payment lifecycle keyed by Medusa cart_id; does not replace Medusa payment_session rows.",
  },
  payment_webhook_events: {
    surfaces: ["storefront", "admin", "api"],
    kind: "bridge",
    notes: "Webhook inbox for idempotent provider event audit and replay; Medusa remains payment SoR.",
  },
  staff_catalog_inventory_audit: {
    surfaces: ["admin"],
    kind: "derived",
    notes:
      "Append-only staff catalog stock adjustment audit; named to avoid public.inventory_movements (Medusa). Medusa inventory_item / levels remain SoR.",
  },
};

/** Exact table names that must never be created in Supabase (Medusa-exclusive). */
export const MEDUSA_EXCLUSIVE_TABLE_NAMES = new Set<string>([
  "order",
  "orders",
  "cart",
  "carts",
  "product",
  "products",
  "variant",
  "variants",
  "line_item",
  "line_items",
  "payment_session",
  "payment_collection",
  "inventory_item",
  "inventory_level",
  "stock_location",
  "fulfillment",
  "fulfillments",
  "region",
  "regions",
  "sales_channel",
  "sales_channels",
  "price_list",
  "price",
  "prices",
  "customer",
  "customers",
]);

/**
 * Returns true if `name` is a forbidden duplicate of a Medusa first-class table name.
 * Does not flag compound names like `product_reviews` or `order_line_items`.
 */
export function isMedusaExclusiveTableName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n || n.includes("_")) return false;
  return MEDUSA_EXCLUSIVE_TABLE_NAMES.has(n);
}
