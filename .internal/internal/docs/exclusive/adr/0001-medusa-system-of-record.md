# ADR 0001: Medusa 2.x as commerce system of record

## Status | Deprecated

Accepted: program start (`2026-03-20`).

## Context

The repo shipped a custom OMS in **Express + `packages/database` + Supabase** (catalog, reservations, Lemon Squeezy, AfterShip, custom admin/POS). The organization targets **Medusa** as the long-lived commerce core to align with standard fulfillment, modules, and ecosystem.

## Decision

1. **Medusa 2.13.x** (pinned with starter in `universal-music-store/apps/medusa`) is the **target system of record** for products, variants, cart, checkout, orders, payments integration, and inventory **after cutover**.
2. **Legacy Express API** remains the production path until phased strangler cutover; **no dual writes** for the same customer order once a route is flagged “Medusa owns this.”
3. **Database:** Medusa receives a **dedicated Postgres** (`DATABASE_URL` in `apps/medusa/.env`), **not** the legacy app schema in-place. Legacy remains for export/import and read-only history.
4. **Monorepo:** Keep `apps/storefront`, `apps/admin`, `apps/api` during migration; add **`apps/medusa`**. Admin may become Medusa Admin + widgets or a thin BFF to Medusa only-decision at Phase 7.
5. **Regions:** Single primary region **Philippines**, currency **PHP**, documented before catalog import.
6. **Express sunset:** Tracked in `internal/docs/MEDUSA-MIGRATION-PROGRAM.md` (Phase 9); date set by team after Phase 8 sign-off.

## Consequences

- New commerce features target **Medusa modules / workflows** per `.claude/skills/building-with-medusa`.
- **Lemon Squeezy** and **AfterShip** move to Medusa payment + subscriber/module patterns before legacy webhook routes are disabled.
- **Risk:** Open orders at cutover-prefer minimal WIP or scripted import (see program doc).

## Apps that survive post–Phase 9

- **Storefront** (Universal Music Store): rewritten or adapted to Medusa Store API / SDK.
- **Medusa** backend + **Medusa Admin** (possibly extended).
- **Legacy Express**: decommissioned or reduced to non-commerce utilities only if still required.
