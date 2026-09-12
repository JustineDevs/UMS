# Data ownership: Medusa vs legacy (Supabase)

This document is the **gate** for new database tables, APIs, and cross-system writes. If a change does not fit the rule below, stop and redesign before merging.

---

## 1. Single rule of ownership

| System | Owns |
|--------|------|
| **Medusa DB** | Everything in the **commerce transaction model**: sellable catalog, price at time of sale, cart, checkout, order, payment, fulfillment, inventory levels, stock locations, regions, tax setup, Medusa customer records, and **native** promotions and pricing when you adopt them. |
| **Legacy DB** (Supabase / `packages/database`) | Everything **outside** Medusa’s product: staff identity and RBAC, CMS and marketing content, compliance exports, device registry, POS operational metadata, audit logs, webhooks stored only for observability, and **optional** analytics marts **derived** from Medusa—not a second source of truth for live commerce. |

**Rule:** No new legacy table may hold authoritative **live** catalog rows, order lines, sellable inventory counts, or checkout-priced totals that duplicate Medusa for the same sale.

---

## 2. Kill duplication with three patterns

**Pattern A: Medusa is truth; legacy reads or mirrors.**  
Legacy stores **references** (`medusa_order_id`, `medusa_customer_id`, `medusa_product_id` where applicable) and **non-commerce** fields only. No parallel `order_line` or live `inventory_count` tables for active storefront/POS sales.

**Pattern B: Legacy is truth; Medusa does not repeat it.**  
Staff roles, blog posts, form submissions, CMS pages: **legacy only**. Do not copy them into Medusa unless Medusa has a first-class module for that domain.

**Pattern C: Bridge at boundaries.**  
When an action touches both worlds (e.g. staff action on an order), use **one write** to Medusa for commerce state and **one write** to legacy for audit or workflow, in the **same request handler**, with explicit ordering and failure handling (compensate or surface error; do not silently diverge).

---

## 3. Practical phases (high level)

### Phase 1: Inventory and freeze

- Maintain a **table inventory** (see appendix) and classify commerce vs platform vs derived.
- **Freeze** new features that add commerce-authoritative fields to legacy unless they map to section 1.
- Add **foreign-style keys** in legacy wherever you mirror: `medusa_customer_id`, `medusa_order_id`, and `medusa_product_id` / variant id for anything tied to catalog or orders.

### Phase 2: Align domains (reduce overlap)

- **Loyalty:** Choose one model: balances in Medusa (metadata, module, promotions) **or** legacy **only** as a **ledger** keyed by `medusa_customer_id` (and email for display). Do not maintain two independent balance concepts without a documented sync contract.
- **Discounts:** Prefer **Medusa Promotion / Pricing** for price-changing rules; use legacy campaigns for **audience and messaging** only, or converge into Medusa over time.
- **Reviews:** Either Medusa-linked metadata on the product **or** legacy-only rows keyed by **Medusa product id** (no duplicate product catalog in legacy).

### Phase 3: Maximize Medusa usage

- **Cart:** Move toward Medusa cart earlier in the journey, or sync a session cart to a Medusa cart id so inventory and promotions apply consistently.
- **Customer:** Prefer **one** Medusa customer per shopper; legacy holds OAuth **staff** identity, not a parallel checkout customer of record.

### Phase 4: Legacy as platform layer

- CMS, RBAC, staff audit, devices, chat intake, channel event log: **legacy only**.
- Optional **read models** in legacy for dashboards (CLV, retention) built from **Medusa exports** or nightly sync—not manual double entry.

### Phase 5: Governance

- PRs must answer: **Does this add duplicate commerce state?** (see `.github/pull_request_template.md`.)
- Naming: legacy tables must not masquerade as live `orders` / `order_items` for web sales; use clear prefixes or domains (`cms_*`, `staff_*`, `audit_*`, `pos_*`, etc.).

---

## 4. What “maximize both” means in practice

- **Medusa:** Deeper use of **Promotion**, **Pricing**, **Customer**, **cart lifecycle**, and **workflows** so pricing rules are not rebuilt in ad hoc SQL outside Medusa.
- **Legacy:** Richer staff, CMS, compliance, and operational tooling without fighting Medusa’s schema.

---

## 5. Anti-patterns (do not ship)

- Storing the same **price** or **quantity sold** in legacy and Medusa for **live** orders.
- Running **campaigns** that change cart totals in legacy while **checkout** only reads Medusa.
- Two **customer IDs** for the same person with no mapping or canonical id.
- New legacy tables that become a second catalog or second order store for production checkout.

---

## Appendix A: Legacy table inventory (Phase 1 baseline)

Source: `packages/database/supabase/migrations/*.sql` (and `seed.sql` where noted). **`pnpm db:migrate`** runs those files once per database and records applied names in **`public.legacy_platform_schema_migrations`** (separate from Medusa’s own migrations on `MEDUSA_DB_URL`). **Classification** is guidance for migration work; Medusa remains SoR for live commerce per section 1.

| Table | Classification | Notes |
|-------|----------------|-------|
| `users` | Legacy platform | OAuth-linked identities (seed); staff/customer linkage per app rules—not parallel Medusa `customer` of record for checkout. |
| `staff_permission_grants` | Legacy platform | RBAC. |
| `channel_sync_events` | Legacy platform | Observability / integrations. |
| `chat_order_intake` | Legacy platform | Intake; commerce fulfillment in Medusa. |
| `employees`, `pos_shifts`, `pos_voids`, `pos_devices`, `offline_pos_queue` | Legacy platform | POS operations; sale lines must reconcile to Medusa where applicable. |
| `loyalty_accounts`, `loyalty_transactions`, `loyalty_rewards` | Commerce-adjacent | Phase 2: align with Medusa customer + single balance model. |
| `customer_segments`, `customer_segment_members` | Marketing / derived | Audience; not authoritative cart or order lines. |
| `campaigns`, `campaign_messages` | Marketing | Messaging; price changes belong in Medusa promotions. |
| `digital_receipts` | Operational | References to Medusa orders expected. |
| `storefront_home_content` | Legacy CMS | |
| `cms_*` (pages, navigation, blog, forms, redirects, experiments, media, etc.) | Legacy CMS | |
| `admin_entity_workflow`, `admin_operator_notes`, `audit_logs` | Legacy platform | Workflow + audit. |
| `product_reviews` | Commerce-adjacent | Must key by Medusa `product` identity (slug or id); not a second catalog. |
| `cart_abandonment_events` | Derived / analytics | No authoritative cart; event stream only. |

**Medusa tables** (not listed here): live in the Medusa Postgres database (`MEDUSA_DB_URL` for `apps/medusa`); catalog, cart, order, payment, inventory, customer (commerce) live there. Schema reference: `internal/docs/exclusive/medusadb/schema.sql`. If the application database (`APP_DB_URL`) ever held mistaken copies of those `public` table names, migration `015_drop_accidental_medusa_core_tables_from_legacy.sql` removes them (apply only to the application database, never to Medusa `MEDUSA_DB_URL`).

---

## Appendix B: PR and ADR gate

- Every PR that adds tables, migrations, or cross-system writes: complete the checklist in `.github/pull_request_template.md`.
- Architecture decision: **`docs/archived/adr/0001-data-ownership.md`**.

---

## Appendix C: Domain field mapping (loyalty, reviews, campaigns)

Mappings below are **legacy Supabase columns → meaning**. Medusa entity definitions live in the Medusa database.

### Loyalty (`004_retail_operations.sql` + app writes)

| Legacy column | Role |
|---------------|------|
| `loyalty_accounts.customer_email` | Lookup and display; not a second customer registry when `medusa_customer_id` is set. |
| `loyalty_accounts.medusa_customer_id` | Canonical link to Medusa Customer. |
| `loyalty_accounts.points_balance`, `lifetime_points`, `tier` | Single ledger; not duplicated on Medusa order rows. |
| `loyalty_transactions.order_id` | Historical column; same Medusa order id as `medusa_order_id` when populated. |
| `loyalty_transactions.medusa_order_id` | Explicit Medusa order reference (migration **009**); new inserts set both. |
| `loyalty_rewards.*` | Reward catalog metadata only; discount **amounts** at checkout remain Medusa promotions/pricing. |

### Reviews (`008` + **009** + **012**)

| Legacy column | Role |
|---------------|------|
| `product_reviews.medusa_product_id` | **Required** on new inserts; Medusa `product.id`. |
| `product_reviews.product_slug` | Denormalized handle for URLs and legacy rows before backfill. |
| `product_reviews.rating`, `body`, `author_name` | UGC only; no product catalog fields. |
| `product_reviews.status`, moderation + verification columns | **012**: `pending` / `approved` / `rejected` / `hidden`; purchase proof references Medusa orders only (not Supabase as commerce authority). |

### Campaigns (`004_retail_operations.sql`)

| Legacy column | Role |
|---------------|------|
| `campaigns.*`, `campaign_messages.*` | **Audience and messaging** (segment, template, channel). |
| (none) | **No** authoritative line-level discount totals for checkout; price-changing rules belong in **Medusa Promotion / Pricing**. |

### Digital receipts & POS voids (**009**)

| Table | Medusa reference |
|-------|------------------|
| `digital_receipts.medusa_order_id` | Backfilled from `order_id` when it is the Medusa order id. |
| `pos_voids.medusa_order_id` | Backfilled from `order_id` when targeting a Medusa sale. |
