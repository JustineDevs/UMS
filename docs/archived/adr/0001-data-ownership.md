# ADR 0001: Data ownership (Medusa vs legacy)

## Status

Accepted

## Context

The monorepo runs **Medusa** as the commerce system of record and **Supabase** (legacy / platform schema in `packages/database`) for staff identity, CMS, audit, POS operations, and derived analytics. Without an explicit split, new features can duplicate catalog, orders, or pricing in both databases.

## Decision

1. Authoritative rules, duplication patterns (A/B/C), phases, and anti-patterns live in **`docs/data-ownership.md`**.
2. New tables and cross-system writes are gated by **`.github/pull_request_template.md`**.
3. Legacy tables that reference Medusa entities use explicit columns: **`medusa_product_id`**, **`medusa_order_id`**, **`medusa_customer_id`** (where applicable), with backfills from legacy `order_id` / product slug fields where those values already denote Medusa ids.
4. **Loyalty** remains a legacy **ledger** keyed by `loyalty_accounts.medusa_customer_id` + email; points lines store **`medusa_order_id`** alongside historical `order_id`.
5. **Product reviews** in legacy store **`medusa_product_id`** plus denormalized `product_slug` for URLs and legacy rows.

## Consequences

- Migrations must add reference columns instead of inventing parallel order or product tables.
- Application code must populate `medusa_*` columns on insert where the Medusa id is known.
- Reviews submission requires the storefront to pass **`medusaProductId`** from the mapped Medusa product.

## Links

- `docs/data-ownership.md`
- `packages/database/supabase/migrations/009_medusa_reference_columns.sql`
