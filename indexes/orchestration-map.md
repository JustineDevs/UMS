# Orchestration map (repository)

Status values: **present**, **partial**, **missing**. Evidence paths point at this monorepo (`apps/*`, `packages/*`). Refreshed from tree and `docs/spec.md` / `AGENTS.md` patterns.

| Layer | Status | Evidence paths | Gap | Suggested owner module |
|-------|--------|------------------|-----|-------------------------|
| Commerce system of record | present | `apps/medusa`, Medusa workflows, `packages/sdk` | Reservation semantics across channels not fully proven in code | Medusa modules + ops runbooks |
| Storefront BFF / UX | present | `apps/storefront`, `src/app/api/checkout/*`, `src/lib/medusa-*.ts` | Depends on Medusa availability and cart field consistency | Storefront lib + API routes |
| Staff admin + RBAC | present | `apps/admin`, `packages/platform-data/src/permissions.ts` | Drift between Supabase ops UI and Medusa truth possible | Admin API routes + session checks |
| Internal HTTP API | present | `apps/api` | Narrow scope; not a second commerce API | Express app |
| Platform identity / ops tables | present | `packages/database`, `packages/platform-data`, Supabase migrations | Schema absence can surface as empty arrays | platform-data + migrations |
| Payments orchestration | present | `apps/medusa/src/modules/*-payment`, `stripe-checkout-payment/service.ts` | Provider keys and webhook delivery are external dependencies | Medusa payment providers |
| Checkout completion | partial | `complete-medusa-cart/route.ts`, `checkout/stripe-return/page.tsx` | Webhook vs complete race mitigated with retries | Storefront API + client retries |
| POS / terminal | partial | `apps/terminal-agent`, `apps/admin` offline queue routes | Not full register-grade stack | terminal-agent + admin POS flows |
| Fulfillment / tracking | partial | Shipment tracking hooks in `apps/medusa`, tracking URL in SDK | Depends on carrier metadata | Medusa subscribers + webhooks |
| Observability | partial | `apps/storefront/src/lib/checkout-telemetry.ts` (`checkout_completion` JSON lines), `apps/medusa/src/lib/webhook-dedup-metrics.ts` (duplicate webhook events), COD delivery logs, `logAdminApiEvent` on admin refund | No central metrics UI; aggregate logs in your host | Ops pipeline / APM |
| Agent-hub documentation package | present | `.cursor/skills/agent-hub/*` | Doc-only; not runtime | N/A |

## Reading order

1. `docs/spec.md` and `docs/data-ownership.md` for Medusa vs Supabase boundaries.
2. `apps/storefront` checkout and `apps/medusa` payment modules for money path.
3. `apps/admin` for staff flows and `packages/platform-data` for RBAC.

## Related

- Command `agent-hub/map` in `.cursor/skills/agent-hub/commands/map.md` (template for other workspaces).
