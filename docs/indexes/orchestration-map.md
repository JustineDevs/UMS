# Orchestration map (repository)

Status values: **present**, **partial**, **missing**. Evidence paths point at this monorepo (`apps/*`, `packages/*`). This map reflects the consolidated `apps/web` + Cloudflare Worker topology.

| Layer | Status | Evidence paths | Gap | Suggested owner module |
|-------|--------|------------------|-----|-------------------------|
| Commerce system of record | present | `workers/backend`, `packages/sdk`, `packages/database` | Reservation semantics across channels not fully proven in code | Worker routes + platform-data |
| Storefront BFF / UX | present | `apps/web`, `apps/web/src/app/api/checkout/*`, `apps/web/src/lib/*` | Depends on Worker availability and cart field consistency | Storefront lib + API routes |
| Staff admin + RBAC | present | `apps/web`, `packages/platform-data/src/permissions.ts` | Drift between platform data and commerce truth possible | Admin API routes + session checks |
| Internal HTTP API | present | `workers/backend` | Narrow scope; not a second commerce API | Cloudflare Worker |
| Platform identity / ops tables | present | `packages/database`, `packages/platform-data`, Supabase migrations | Schema absence can surface as empty arrays | platform-data + migrations |
| Payments orchestration | present | `workers/backend`, `apps/web/src/app/api/checkout/*` | Provider keys and webhook delivery are external dependencies | Worker payment handlers |
| Checkout completion | partial | `complete-medusa-cart/route.ts`, `checkout/stripe-return/page.tsx` | Webhook vs complete race mitigated with retries | Storefront API + client retries |
| POS / terminal | partial | `apps/terminal-agent`, `apps/web` offline queue routes | Not full register-grade stack | terminal-agent + admin POS flows |
| Fulfillment / tracking | partial | `workers/backend`, tracking URL in SDK | Depends on carrier metadata | Worker handlers + webhooks |
| Observability | partial | `apps/web/src/lib/checkout-telemetry.ts` (`checkout_completion` JSON lines), Worker logs, COD delivery logs, `logAdminApiEvent` on admin refund | No central metrics UI; aggregate logs in your host | Ops pipeline / APM |
| Agent-hub documentation package | present | `.cursor/skills/agent-hub/*` | Doc-only; not runtime | N/A |

## Reading order

1. `docs/spec.md` and `docs/data-ownership.md` for Medusa vs Supabase boundaries.
2. `apps/web` checkout and `workers/backend` payment handlers for the money path.
3. `apps/web` for staff flows and `packages/platform-data` for RBAC.

## Related

- Command `agent-hub/map` in `.cursor/skills/agent-hub/commands/map.md` (template for other workspaces).
