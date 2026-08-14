---
title: Universal Music Store
description: A composable commerce system for music retail across storefront, POS, and fulfillment.
author: @Justinedevs
website-to: https://universalmusic.vercel.app
status: Draft
type: Informational
created: 2026-03-20
requires tech stack:
 - Next.js App Router
 - Medusa 2.x (commerce engine, dedicated Postgres)
 - Node.js + Express (minimal sidecar: health, compliance)
 - PostgreSQL (Medusa DB + Supabase Postgres for legacy/auth/compliance)
 - Turborepo + pnpm
 - Tailwind CSS + shadcn/ui
 - NextAuth/Auth.js
 - Medusa payment modules (Stripe, PayPal, and others per configuration)
 - shipment tracking provider
---

## Abstract

This specification defines a composable music retail platform for a store operating through a customer storefront, internal admin dashboard, point-of-sale terminal, and centralized order management. **Commerce truth for catalog, cart, checkout, orders, and payments runs on Medusa 2.x** (`universal-music-store/apps/medusa`) with a **dedicated PostgreSQL** database. Legacy **Supabase** schema and `packages/database` remain for **staff OAuth user records**, **compliance exports**, **migration tooling**, and optional historical data; they are **not** the runtime path for new web checkout when the storefront is wired to Medusa.

### Implementation status (do not over-read this document)

- **Medusa commerce core**: implemented in-repo.
- **Supabase payment ledger** (`payment_attempts`, webhooks table): implemented; bridges hosted pay and recovery paths.
- **Server-owned COD completion**: implemented via `POST /api/checkout/cod-place-order` (browser no longer calls `cart.complete` for COD in `medusa-checkout.ts`).
- **Strict stock / inventory rules**: see `docs/data-ownership.md` and code; not every paragraph in this file is a hard runtime guarantee unless verified in code and tests.


## Specification

### 1. System Scope

The platform SHALL provide two application environments:

1. A public customer storefront for product discovery, checkout, tracking, and account access.
2. An internal operations environment for admin analytics, inventory control, POS transactions, and order fulfillment.

The platform SHALL maintain **one operational source of truth for live commerce** for products, variants, inventory, orders, payments, and shipments: **Medusa** after cutover. **Legacy Supabase** tables may remain for migration and non-commerce app data until fully retired.

### 2. Technology Stack

The implementation SHALL use the following stack:

- Frontend applications: Next.js App Router (`apps/storefront`, `apps/admin`)
- Commerce engine: **Medusa 2.x** (`apps/medusa`) with Store API and Admin API
- Commerce database: **PostgreSQL** dedicated to Medusa (`DATABASE_URL` for Medusa only)
- Legacy / auxiliary database: **PostgreSQL via Supabase** for OAuth-linked users, compliance tooling, and legacy schema exports (`packages/database`)
- Minimal API server: **Node.js + Express** (`apps/api`) for health probes and compliance endpoints only (not primary commerce HTTP)
- Monorepo orchestration: Turborepo with pnpm workspaces
- UI layer: Tailwind CSS with shadcn/ui
- Authentication: NextAuth/Auth.js with Google provider (staff and customer; admin UI protected by middleware on `/admin/*`)
- Payments: one or more **Medusa** payment providers (for example Stripe, PayPal, Xendit, cash on delivery), selected per region and Medusa server environment variables (`medusa-config.ts`)
- Shipment tracking: provider integration with J&T Express Philippines (Medusa subscriber + webhook hook on Medusa)

Shared types, validation logic, UI primitives, and **clients** (`packages/sdk`, `packages/types`) SHOULD be placed in reusable monorepo packages and consumed by all apps.

### 3. Monorepo Structure

The repository SHALL be organized into application and package boundaries.

#### 3.1 Applications

- `apps/storefront` for the public commerce frontend (Medusa Store API + JS SDK for catalog, checkout, tracking)
- `apps/admin` for dashboard, POS, and fulfillment UI; Next.js **Route Handlers** under `app/api/**` proxy to Medusa where needed
- `apps/medusa` for the **commerce backend**: cart, orders, payments, inventory locations, fulfillments, webhooks
- `apps/api` for **health** (`/health`) and **compliance** (`/compliance`, internal key); not the primary commerce API surface

#### 3.2 Shared Packages

- `packages/types` for shared domain types (Product, variants, images)
- `packages/validation` for shared Zod schemas (shop query params, order status, roles); storefront `/shop` uses these for URL/query validation
- `packages/rate-limits` for env-driven Express rate-limit presets (wired to `apps/api` compliance routes; Medusa store limits stay in `apps/medusa`)
- `packages/database` for **Supabase legacy schema**, compliance queries, OAuth user upsert, and **export/migration scripts** (not live web checkout when Medusa-only)
- `packages/config` for TypeScript, linting, and styling configuration
- `packages/sdk` for Medusa URL, keys, env assertions, and shared helpers

### 4. Functional Pages

The storefront SHALL include the following pages:

- `/` Home page
- `/shop` Product listing page
- `/shop/[slug]` Product detail page
- `/checkout` Checkout page
- `/track/[orderId]` Order tracking page
- `/account` Customer account page

The internal application SHALL include the following pages:

- `/admin` Dashboard
- `/admin/inventory` Inventory management
- `/admin/orders` Order fulfillment hub
- `/admin/orders/[orderId]` Order detail: line items, staff shipment registration, mark shipped / delivered
- `/admin/pos` POS terminal

### 5. Catalog and Variant Model

The catalog SHALL support parent products and sellable product variants.

#### 5.1 Products

A product represents the parent music retail item and SHALL contain:

- Name
- Slug
- Description
- Category
- Brand
- Status
- Product images

#### 5.2 Product Variants

A variant represents the sellable stock-keeping unit and SHALL contain:

- Product reference
- SKU
- Barcode
- Type
- Finish
- Selling price
- Optional compare-at price
- Optional cost
- Active status

A unique combination of `product_id`, `size`, and `color` MUST identify one variant only.

### 6. Inventory Model

Inventory SHALL be controlled at the product variant level.

#### 6.1 Inventory Locations

The system SHALL support named stock locations such as:

- Warehouse
- Retail store
- Returns
- Damaged stock

#### 6.2 Inventory Movements

All stock changes MUST be recorded as immutable inventory movements. Supported movement reasons SHOULD include:

- Opening stock
- Purchase
- Reservation
- Reservation release
- Sale
- Return
- Adjustment
- Damage
- Transfer in
- Transfer out

The platform MUST NOT rely on manual stock overwrites as the only source of truth.

#### 6.3 Stock Reservations

The system SHALL support temporary reservation of variant stock during checkout and POS payment initiation. Reservations MUST expire if payment is not completed within the configured timeout window.

### 7. User and Role Model

The platform SHALL use one canonical user model for both customers and staff.

Supported roles SHALL include:

- `admin`
- `staff`
- `customer`

Google OAuth SHALL be supported through NextAuth/Auth.js. Session and provider-link records SHALL be associated with the canonical user entity.

### 8. Order Management System

The order management system SHALL support both web and POS orders.

#### 8.1 Order Header

An order SHALL contain:

- Order number
- Customer reference
- Billing address
- Shipping address
- Sales channel
- Status
- Currency
- Monetary totals
- Notes
- Creation metadata

#### 8.2 Order Items

Each order item SHALL snapshot the following values at purchase time:

- Variant reference
- SKU
- Product name
- Type
- Finish
- Unit price
- Quantity
- Line total

Catalog updates after purchase MUST NOT mutate historical order-item values.

#### 8.3 Order Channels

Supported channels SHALL include:

- `web`
- `pos`

#### 8.4 Order Statuses

Supported statuses SHALL include:

- `draft`
- `pending_payment`
- `paid`
- `ready_to_ship`
- `shipped`
- `delivered`
- `cancelled`
- `refunded`

### 9. Payment Flow

Payments SHALL be processed through **Medusa payment sessions** using whichever providers are **registered and enabled** for the deployment (see Medusa `medusa-config` and environment variables).

The system SHALL support:

- Storefront checkout: Medusa cart → `initiatePaymentSession` → provider-specific completion (hosted redirect, embedded flow, or other behavior defined by the active module)
- POS orders via Medusa **draft orders** and conversion to orders (`apps/admin` BFF → Medusa Admin API)
- **Webhook-based payment confirmation** on **Medusa** where the provider supplies webhooks: signature verification in the corresponding payment module and idempotency via provider-specific dedup helpers where implemented
- Payment and order state in **Medusa Postgres**

The **Medusa** payment pipeline MUST verify incoming payment webhooks before changing payment or order state when webhooks are used. The Express `apps/api` service does **not** host primary payment webhooks in this architecture.

An order MUST NOT be marked as paid solely from client-side redirect or return URL state.

### 10. Shipment Flow

Shipment tracking SHALL be integrated through a carrier tracking provider using J&T Express Philippines as the carrier context.

Each shipment SHALL support:

- Internal order reference
- Carrier slug
- Tracking number
- External tracking identifier
- Label URL when available
- Shipment status
- Checkpoint text
- Shipment timestamps

The customer tracking page SHALL render shipment progress based on **Medusa** order and fulfillment state, including metadata updated from shipment tracking webhooks processed by Medusa.

Anonymous tracking SHALL use a **scoped secret** (e.g. HMAC of order id) conveyed in the URL query string so that knowledge of the order UUID alone is insufficient to read order or shipment data.

After checkout begins, the platform SHOULD email the buyer (when an email address is collected and transactional email is configured) a message containing the **same signed tracking URL** shown on the checkout step before hosted payment.

### 11. OMS Processing Flow

The standard **Medusa** order flow SHALL be:

1. Customer or cashier selects a product variant (storefront cart is browser **session storage** until checkout builds a **Medusa cart**).
2. Variant availability is enforced by **Medusa** inventory and checkout completion rules.
3. Web checkout: Medusa cart, shipping method, payment session, then completion through the **configured** payment provider; **POS**: draft order → convert to order via Medusa Admin API.
4. Payment completes when the **provider and Medusa** agree on state (for example verified webhook or provider API confirmation), not from client return URL alone.
5. Order and fulfillment state live in **Medusa**; inventory movements follow Medusa workflows.
6. Fulfillment: staff operations align with **Medusa** fulfillments; shipment tracking registration and inbound webhooks run in **Medusa** (subscriber + hook).
7. Customer tracking reads **Medusa** order and fulfillment data on the storefront.

**Legacy Express + Supabase** reservation and checkout flows in older revisions are **not** the documented live path once the storefront and admin use Medusa only. Legacy mutation code may still exist under `packages/database` for tooling; **apps** do not import it for new commerce in the Medusa-only configuration.

All inventory mutations for web and POS orders MUST pass through the **Medusa** commerce boundary for production.

### 12. SOP Requirements (Medusa implementation)

**Canonical runbook:** Day-to-day operations when **Medusa** is the live system of record are documented in the active runbook set under **`docs/runbooks/`**, including deployment, environment, and payment-operation procedures.

The implementation SHALL satisfy the following when production is configured with the storefront and admin **Medusa** env vars set, **`LEGACY_COMMERCE_API_DISABLED=true`** where legacy Express commerce existed, and payment plus shipment tracking webhooks targeting **Medusa** as designed:

1. **Catalog:** New products and variants are created **only** in **Medusa Admin** (handles, options, SKUs, images, inventory at **Warehouse PH**, sales channel **Web PH**); no parallel live catalog in legacy Postgres for production SKUs.
2. **Stock:** Adjustments use **Medusa** inventory flows with audit trail; not raw SQL against production.
3. **Web orders:** Checkout and payment confirmation run through **Medusa** and the enabled payment provider(s); support looks up orders in **Medusa Admin**; tracking UX reads **Medusa** fulfillment data in production.
4. **POS:** In-store sales use **Medusa** draft-order / POS or **Medusa APIs only**; not legacy Express `POST /orders` in production.
5. **Fulfillment:** Pick/pack/ship and tracking align **Medusa** fulfillments with carrier and the tracking provider as integrated; customer track page does not depend on legacy Express in production.
6. **Health:** Daily checks cover Medusa, storefront, webhook error rates, and stuck orders per **SOP-6** in the runbook.

**Definition of done (operational):** As in **SOP-9** of `SOP-OPERATIONS-MEDUSA.md`: every live SKU and order path runs through **Medusa**; staff can execute standard catalog through fulfillment steps without developer assistance.

**Legacy stack note:** **§12** and `SOP-OPERATIONS-MEDUSA.md` supersede routine legacy OMS procedures for production. Any remaining Express + Supabase commerce flows are **out of scope** for new live traffic once Medusa-only operation is declared.

### 13. Runtime responsibilities (Medusa vs Express)

**Medusa (`apps/medusa`)** SHALL own:

- Store and Admin HTTP APIs for commerce
- Payment provider modules (per `medusa-config` and environment; examples include Stripe, PayPal, Xendit, cash on delivery) and **payment webhook verification** where applicable
- Shipment tracking inbound webhook and **fulfillment** subscriber registration with the tracking provider API
- Order, cart, inventory, and fulfillment domain logic
- **Webhook idempotency** for payment providers that use dedup helpers in their Medusa modules

**Express (`apps/api`)** SHALL own:

- **`GET /health`** (and nested health routes) including optional Medusa reachability when `MEDUSA_BACKEND_URL` is set
- **`/compliance`** routes (internal API key) for data-subject export and retention anonymization using **Supabase** via `packages/database`

**Next.js (`apps/admin`, `apps/storefront`)** SHALL own:

- UI, NextAuth session, **middleware** protecting `/admin/*` for staff roles
- Server **Route Handlers** that call Medusa with secret keys (POS and order BFF patterns)

Webhook processing MUST be idempotent where implemented; persist provider event metadata for replay safety per Medusa and provider docs.

### 14. Non-Functional Requirements

The platform SHOULD satisfy the following operational goals:

- Shared types across all applications
- Consistent UI primitives across storefront and internal tools
- Clear service boundaries between UI, business logic, and database access
- TypeScript code with linting and tests. Calling a deployment production-ready requires separate operational validation (monitoring, runbooks, provider health)
- Migration-based database evolution
- Copy-pasteable environment configuration
- Deployment compatibility with branch-based staging and production workflows

### 15. Stakeholder business requirements (Universal Music Store intake)

The following rows are taken from the submitted **Business Requirement Form** (`internal/docs/exclusive/Universal Music Business Requirement Form.csv`). The on-disk artifact is a **ZIP** wrapping the CSV export; see `ARCHITECTURE-DELIVERABLE.md` §1 for how to open it.

| Topic | Stated requirement |
|--------|---------------------|
| Business | Universal Music Store |
| Contact | support@universal-music-store.com |
| Current sales channels | Facebook / Instagram |
| Target launch date | 2026-04-10 |
| Scale | 500+ SKU positions / items in stock (stated as “500+”) |
| Product attributes | Category (guitar/electric guitar/acoustic guitar/bass/piano/drums/accessories & gear/etc.); type; finish; **material**; **condition (new / old stock)** |
| Variant / tracking dimensions | Type variants; finish variants; **style variants**; **bundle packs** |
| Additional services | **Custom printing**; **bulk orders**; **custom merch runs** |
| Admin / POS users | Owner; sales clerk; accountant |
| Minimum reorder level | **1000** per SKU (stated in form) |
| Customer Google login | **Yes**: faster checkout |
| Pre-orders when out of stock | **Yes** |
| Payment methods (desired) | PayPal; GCash or bank transfer with **manual receipt upload**; **COD** |
| Promo codes / vouchers | **Yes** |
| Fit/option guide on PDP | **Yes** |
| Return / exchange | Flexibility level **3** (scale in form); details in `docs/Exchange Policy Details.md` |
| J&T pickup address | B16 L45 ACM Paramount Homes, Brgy. Navarro, General Trias, Cavite |
| J&T rate calculation at checkout | **Yes**: by weight / dimensions |
| Tracking notifications | **Yes**: automated SMS **and** email |
| Average parcel weight | **5 kg** (per form; validate with ops: may be ~0.5 kg in practice) |
| Typical parcel dimensions | 10 × 10 × 10 (units assumed cm) |
| Shipping zones | **Separate rules** for Metro Manila, provincial, **international** |
| Business permits (payments) | **Processing** (DTI/SEC + BIR 2303 path in progress) |
| Domain | Not owned yet (“N/A” in form) |
| FB Shop / TikTok Shop | **No** for launch |
| Commercial rules (notes) | Example: **free shipping** when order quantity crosses thresholds (e.g. 10–20+ pieces) |

#### 15.1 As-built vs intake (explicit gaps)

This repository’s **as-built** commerce path is **Medusa** for orders and payments, **Next.js** for storefront and admin UI, and a carrier tracking provider for tracking integration where enabled. **Express** is **not** the live commerce API. **Legacy** Supabase tables and `packages/database` mutation helpers remain in the repo for **migration and compliance**; **current** applications under `apps/` import **only** compliance and OAuth user helpers from that package, not legacy checkout/order creation for new sales.

The **as-built** slice **does not yet implement** every stakeholder cell above. Track these deltas in backlog, not as optional “nice-to-haves” when the business has already answered **Yes**:

- **Payments:** The code supports several **Medusa** payment modules; the **live** combination depends on Medusa environment variables and storefront flags (for example `NEXT_PUBLIC_CHECKOUT_PAYMENT_PROVIDERS`, `NEXT_PUBLIC_MEDUSA_PAYMENT_PROVIDER_ID`). Stakeholder-requested methods such as GCash or bank transfer with manual proof need explicit product and reconciliation design; they are not automatic substitutes for card or wallet flows.
- **Catalog:** **Material**, **condition**, **style**, and **bundle** constructs may need Medusa **metadata** or admin UX beyond default product fields.
- **Pre-orders:** Requires sellable state when `available_qty = 0`, distinct reservations, and fulfillment SLAs.
- **Shipping:** Automatic J&T rating by weight/dimensions + **zone tables** (Metro / provincial / international) and “free shipping at N pieces” need quote service + rules engine + tests.
- **Notifications:** **Resend** (optional) sends **checkout-started** email with signed tracking link when `RESEND_*` is configured; **SMS** and full order-lifecycle alerts are not wired.
- **Reorder / low stock:** Intake states **1000** minimum per SKU; wire to low-stock jobs and admin surfacing.
- **Customer Google OAuth:** NextAuth exists; **account linking** and **order history by user** remain productized per §7–8.

### 16. Medusa as system of record (current state)

The repository includes **Medusa 2.x** (`apps/medusa`) as the **system of record** for live commerce domains. **Storefront** and **admin** are implemented against **Medusa** APIs for catalog, checkout, POS, and tracking. The migration scripts (`seed:ph`, `import:legacy-catalog`, `import:legacy-inventory`) support **data movement** from legacy Supabase into Medusa, not parallel live writes for the same order.

**Production operations** follow the active runbooks under **`docs/runbooks/`** in conjunction with **§12** above. Historical cutover artifacts may still exist under `internal/docs/exclusive/`, but the checked-in `docs/` tree is the maintained reference set for this repository.

## Rationale

The layout separates public storefront, staff tools, and the commerce engine so each layer can change on its own schedule while **one Medusa inventory and order model** serves live traffic. Variant-level stock and fulfillment fit Medusa’s usual patterns. **Express** stays a **small** service (health, compliance, internal key) instead of duplicating commerce APIs. **Next.js** handles UI and sessions; **Medusa** holds commerce rules and data for the domains it owns.

## Security Considerations

Payment and shipping webhooks MUST be verified before mutating order, shipment, or inventory state (**Medusa** payment modules and tracking provider hook on Medusa). All privileged admin and POS routes MUST require authenticated staff roles (**NextAuth** session + middleware on `/admin/*` for UI; **requireStaffSession** in admin API routes), and customer routes MUST be isolated from internal operations. Sensitive credentials including OAuth secrets, payment secrets, API keys, and database connection strings MUST be stored in environment variables and never exposed in client bundles. Inventory changes SHOULD be auditable through immutable movement records and attributable to a user or system process whenever possible.

## Copyright

Copyright (c) 2026 @JustineDevs. All rights reserved.
