# ADR 0002: Supabase scope — identity, compliance, archive only

## Status

Accepted: 2026-03-22.

## Context

The repo has two databases: **Medusa Postgres** (commerce system of record) and **Supabase Postgres** (legacy schema, OAuth users, compliance). ADR-0001 established Medusa as the commerce owner. Supabase was historically used for full OMS; after cutover, its role must be narrowed to avoid duplicated ownership and accidental commerce writes.

## Decision

**Supabase owns only:**

1. **Identity and RBAC** — Staff users, OAuth-linked user records, role flags, and app-level profile data that is not a commerce order object.
2. **Compliance and privacy operations** — DSAR export, anonymization, retention jobs, and audit-oriented PII workflows.
3. **Migration and archive layer** — Legacy catalog/order/inventory history for export, audit, or rollback reference (read-only / archive intent).
4. **Internal control-plane data** — Operational records for the app platform, not Medusa commerce truth.

**Medusa owns all commerce entities:** Catalog, carts, checkout, orders, payments, inventory, fulfillments. No new feature may add order, payment, inventory, shipment, or checkout writes to Supabase or `packages/database` (or its successors).

**Package rule:** No new feature may add commerce mutation exports (order create, checkout, payment, reservation, fulfillment, inventory write) to shared database packages. Legacy commerce helpers remain in archive/migration-only surfaces.

**Operating model:** Medusa handles transaction truth and provider/webhook state. Supabase handles people, permissions, compliance, and history. No app feature may write an order, payment, inventory, fulfillment, or shipment outside Medusa.

## Consequences

- `packages/database` and `packages/platform-data` enforce this boundary.
- Apps import only identity, compliance, and client from the Supabase-backed package.
- CI/lint may fail if app code imports forbidden legacy commerce mutations.
- Supabase schema may evolve toward `users`, `user_roles`, `compliance_*`, `audit_logs`, `legacy_*` archive views.

## References

- ADR-0001: Medusa as commerce system of record
- `internal/docs/exclusive/fixes/package-boundary-cleanup.md`
- `internal/docs/spec.md` §12, §13
- Domain ownership table (spec/runbook)
