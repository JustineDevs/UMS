## Current architecture (aligned with repo)

**Live commerce** runs on **Medusa 2.x** (`universal-music-store/apps/medusa`) with a **dedicated Postgres** (`DATABASE_URL` for Medusa only). The **storefront** uses the Medusa **Store API** (`@medusajs/js-sdk`) for catalog, checkout (cart → payment session → Lemon URL), and tracking. The **admin** app uses **NextAuth** (`middleware` on `/admin/*` for `admin`/`staff` roles) and **Next.js Route Handlers** under `app/api/pos/medusa/**` and `app/api/medusa/**` to call Medusa with server-side secrets.

**Express** (`universal-music-store/apps/api`) is **minimal**: **`/health`** (including optional Medusa probe) and **`/compliance`** (internal API key) for GDPR-style export and anonymization via **Supabase** through `packages/database`. It is **not** the primary payment or catalog API.

**Legacy Supabase** schema and `packages/database` query modules (orders, checkout, inventory) **still exist** for **migration scripts**, **compliance**, and **OAuth user upsert**; **no** `apps/*` commerce route imports legacy checkout/order creation for new sales in the Medusa-only configuration. See `internal/docs/adr/0001-medusa-system-of-record.md` and `internal/docs/exclusive/fixes/today/CUTOVER-COMMERCE-OWNERSHIP.md`.

---

## Stack

| Layer | Technology | Purpose |
|---|---|---|
| Storefront / Admin UI | Next.js App Router | Public shop, account pages, staff dashboard, POS UI. |
| Commerce engine | **Medusa 2.x** | Catalog, cart, orders, payments, inventory locations, fulfillments, Store + Admin APIs. |
| Commerce DB | **PostgreSQL** (Medusa) | System of record for live commerce data. |
| Legacy / auxiliary DB | **Supabase Postgres** | OAuth-linked users, compliance exports, legacy schema for migration tooling. |
| Sidecar API | **Node.js + Express** | Health and compliance endpoints only; not primary webhooks for Lemon/AfterShip. |
| Monorepo | Turborepo + pnpm | Shared `packages/types`, `packages/sdk`, `packages/validation`, etc. |
| UI | Tailwind CSS + shadcn/ui | Customer and internal screens. |
| Payments | **Lemon Squeezy** (Medusa module) + optional Stripe, PayPal, Paymongo, COD in Medusa | Hosted checkout; webhooks verified inside Medusa. |
| Shipping | **AfterShip** + J&T (Medusa subscriber + webhook on Medusa) | Tracking registration and order metadata updates. |
| Auth | NextAuth + Google | Staff and customers; admin routes gated by middleware. |

---

## Data model (two layers)

### A. Medusa (authoritative for live commerce)

Product, variant, cart, order, payment collection, fulfillment, and inventory for **production** traffic are modeled in **Medusa’s database** (Medusa migrations). Staff create and edit catalog in **Medusa Admin** (or via Admin API). **Do not** treat legacy Supabase `products` / `orders` tables as the live source after Medusa cutover.

### B. Supabase legacy schema (retained for migration and tooling)

The following tables remain documented for **historical** and **migration** context; **runtime** web and POS flows target **Medusa** instead:

| Table | Purpose |
|---|---|
| `users` | Canonical identity for staff/customers via OAuth upsert (`packages/database`). |
| `accounts`, `sessions` | NextAuth provider links and sessions. |
| `products`, `product_variants`, `inventory_*`, `orders`, `order_items`, `payments`, `shipments`, `stock_reservations` | **Legacy** OMS; mutation helpers still in `packages/database` for scripts—not used by current Medusa-first apps for new checkout. |
| Compliance-related reads/writes | Via `packages/database` compliance queries and Express `/compliance` routes. |

---

## OMS flow (Medusa)

1. **Catalog:** Create products and variants in **Medusa Admin** (region, sales channel, inventory locations such as Warehouse PH).
2. **Web:** Shopper browses via Store API; cart is **session storage** until checkout creates a **Medusa cart**, adds shipping, starts **payment session**, redirects to **Lemon**.
3. **Payment truth:** **Lemon** webhook hits **Medusa**; signature verified; payment session completes; order **not** paid on client redirect alone.
4. **POS:** Staff uses admin UI → **Route Handlers** → Medusa **Admin API** (lookup, draft order, convert to order).
5. **Fulfillment:** Pick/pack in **Medusa**; **AfterShip** registration from fulfillment subscriber; inbound AfterShip webhook updates **order metadata** on Medusa.
6. **Tracking:** Storefront reads **Medusa** order and fulfillment data for `/track`.

---

## SOP

Normative runbook: **`internal/docs/SOP-OPERATIONS-MEDUSA.md`**. Short reminders:

- **Catalog SOP:** Medusa Admin for products, variants, options, SKUs, images, and stock locations.
- **Web order SOP:** Medusa cart → Lemon checkout → webhook on Medusa → paid order.
- **POS SOP:** Medusa draft order / convert; staff auth via NextAuth + middleware.
- **Fulfillment SOP:** Medusa fulfillments + carrier tracking; AfterShip aligned with Medusa order id in custom fields.

---

## Sprint plan (historical bootstrap)

The table below reflects an **early** monorepo bootstrap. **Current** delivery follows **Medusa** ownership, **cutover** PRs (`internal/docs/exclusive/fixes/today/COMMERCE-CUTOVER-PROGRAM.md`), and the ADR—not a seven-day Express-first build.

| Day | Deliverable (historical) |
|---|---|
| Day 1 | Repo bootstrap, pnpm workspace, Turbo pipelines, env setup, Supabase schema, seed data, Google auth base. |
| Day 2 | Legacy catalog APIs and admin inventory (superseded by Medusa for live catalog). |
| Day 3 | Storefront home, shop, PDP, cart, checkout handoff to Lemon Squeezy. |
| Day 4 | Payment webhooks and POS (superseded by Medusa modules and admin BFF). |
| Day 5 | Orders hub, shipment records, AfterShip, tracking page. |
| Day 6 | QA, webhook tests, role checks, staging deploy. |
| Day 7 | UAT, production deploy, launch checklist. |

**Current milestone themes:** Medusa-only env, webhook URLs per provider, retire legacy Express commerce imports, `packages/database` boundary cleanup per `internal/docs/exclusive/fixes/package-boundary-cleanup.md`.
