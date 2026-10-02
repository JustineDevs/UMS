# ADR 0003: Specification compliance — remaining work vs `internal/docs/spec.md`

## Status

Accepted: 2026-03-26.

## Context

`internal/docs/spec.md` is the normative platform specification (SHALL / MUST language). ADR-0001 and ADR-0002 bound commerce ownership (Medusa) and Supabase scope. The codebase implements the **Medusa-first** path for catalog, cart, checkout (Lemon Squeezy), orders, admin BFF, and AfterShip-oriented fulfillment, with Next.js storefront and admin, Express health/compliance, and shared packages.

This ADR records **where the as-built system does not yet satisfy the specification**, so backlog and design reviews can trace gaps to explicit sections instead of informal notes.

## Decision

1. **Track gaps in this ADR** until closed; when a gap is fully implemented and tested, remove or narrow it here in a follow-up commit (or supersede with a short “Resolved” subsection dated by release).

2. **Source of truth for intake rows** remains `internal/docs/spec.md` §15 and §15.1, plus the stakeholder form artifact referenced there.

3. **No reinterpretation:** Items below are gaps relative to the spec’s wording, not a replacement priority list for the product owner.

## Remaining gaps (by spec area)

### §4 Functional pages

Confirm every listed route exists, is linked from navigation where appropriate, and matches the Medusa-backed behavior described in the spec. Any route that is stubbed, redirects only, or reads legacy data must be treated as non-compliant until aligned with Medusa.

### §5 Catalog and variant model

- **Material, condition (new / old stock), style variants, bundle packs** (see §15 intake): not fully modeled as first-class fields or workflows; may require Medusa metadata, product types, or admin UX extensions beyond default product/variant fields.

- **Uniqueness rule** (`product_id`, `size`, `color` unique per variant): must be enforced in catalog creation/import and guarded in admin tooling.

### §6 Inventory model

- **Named locations** (warehouse, retail, returns, damaged): verify Medusa stock locations and operational naming match SOP; admin UX must reflect all intended locations.

- **Immutable inventory movements** with enumerated reasons (opening stock through transfer out): the spec requires a durable movement history, not ad hoc stock edits. Medusa inventory events must be verified end-to-end; any gap needs workflows, reporting, or exports.

- **Reservations with timeout**: checkout/POS reservation behavior must match “expires if payment not completed within configured window” (Medusa-aligned implementation and configuration).

### §7 User and role model

- **Single canonical user model** across customer and staff: partially realized via NextAuth and platform data; **account linking** and **customer order history tied to identity** (spec §15.1) need a complete productized flow, not only sign-in.

### §8 Order management

- **Channel and status enumerations**: map Medusa order/cart states to the spec’s `web` / `pos` channels and listed statuses (`draft` through `refunded`) in UI, APIs, and reporting; document any intentional subset.

- **Order item snapshots**: verify no code path mutates historical line items after purchase.

### §9 Payment flow

- **Lemon Squeezy via Medusa** is the documented production web path; **additional methods** from intake (PayPal, Paymongo, COD, GCash/Maya manual receipt, bank transfer) require Medusa modules or custom flows, reconciliation, and tests. Manual proof uploads and bank transfer are **not** equivalent to Lemon webhook semantics; each needs its own fraud and operations design.

- **Order MUST NOT be marked paid from client redirect alone:** verify all “paid” transitions are webhook- or server-verified.

### §10 Shipment flow

- **AfterShip + J&T context**: verify carrier metadata, subscriber, and inbound webhook behavior match operational needs.

- **Anonymous tracking with scoped secret (e.g. HMAC)** so bare order UUID is insufficient: implement and test query/token rules on `/track` (or equivalent) per spec.

- **Post-checkout email** with the **same signed tracking URL** as pre-payment checkout when transactional email is configured (Resend or other): partial optional behavior exists; full lifecycle parity with spec is not done until SMS/email notifications (see below) are addressed.

### §11 OMS processing flow

- End-to-end alignment with numbered steps (cart, payment truth, fulfillment, tracking read path): validate with integration or E2E tests; legacy Express paths must remain out of production traffic per ADR-0001/0002.

### §12 SOP requirements

- **Operational definition of done** in `internal/docs/SOP-OPERATIONS-MEDUSA.md` must be satisfied for production declarations; any checklist item not automatable in CI remains a manual gate until implemented.

### §14 Non-functional requirements

- **Shared types**, **consistent UI primitives** (Tailwind + shadcn/ui pattern), **clear boundaries**, **TypeScript quality**, **migrations**, **env documentation**, **staging/prod workflows**: continuous improvement; specific gaps (e.g. full shadcn coverage across every screen) are backlog unless called out in UX audits.

### §15 Stakeholder intake (business requirements)

The following intake items are **not fully implemented** as productized, production-ready features (see also §15.1 in the spec):

| Area | Requirement (summary) | Notes |
|------|------------------------|--------|
| Scale | 500+ SKU positions | Operational capacity vs. catalog count; verify performance and admin usability at scale. |
| Attributes | Material, condition | See §5. |
| Variants | Style variants, bundle packs | See §5. |
| Services | Custom printing, bulk orders, uniform orders | Workflows, quoting, pricing, and order attribution not fully specified in code. |
| Reorder | Minimum 1000 per SKU | Low-stock alerts, jobs, admin surfacing per spec reference. |
| Pre-orders | When out of stock | Sellable state at zero available qty, reservations, SLAs. |
| Payments | PayPal, GCash/Maya manual, COD, bank transfer | Beyond Lemon; see §9. |
| Promotions | Promo codes / vouchers | Medusa promotions or equivalent; rules and testing. |
| PDP | Size guide | PDP content and UX. |
| Returns | Exchange policy level 3 | Policy content and operational flow in OMS. |
| Shipping | J&T rate by weight/dimensions | Quote service and carrier integration. |
| Shipping | Zones: Metro, provincial, international | Rules engine + tests. |
| Shipping | Free shipping at quantity thresholds | Commercial rules (e.g. 10–20+ pieces). |
| Notifications | SMS and email tracking updates | Full lifecycle; Resend partial paths do not satisfy “SMS and email” alone. |
| Permits | DTI/SEC/BIR | Non-software; track as business readiness. |
| Domain | Not owned | DNS and TLS when domain is acquired. |

### §16 Medusa as system of record

- **Migration tooling** exists; **parallel live writes** for the same order must never occur. Cutover docs (`COMMERCE-CUTOVER-PROGRAM.md`, etc.) govern flags and sequencing.

### Security considerations (spec closing section)

- **Webhook verification** for payment and shipping: must remain mandatory on every path that mutates money or shipment state.

- **Staff vs customer isolation**: ongoing review of `/admin/*` and Medusa Admin API usage with secrets.

- **No secrets in client bundles:** lint and build checks where applicable.

## Consequences

- Roadmap and sprint planning can reference this ADR alongside `spec.md` §15.1.
- Closing a gap should include automated tests where feasible (unit, integration, or E2E per `release-gate-spec.md`).
- This document should **not** be treated as permission to bypass the spec; it is an explicit backlog register.

## References

- `internal/docs/spec.md` (especially §6–§11, §15, Security considerations)
- ADR-0001: Medusa 2.x as commerce system of record
- ADR-0002: Supabase scope — identity, compliance, archive only
- `internal/docs/SOP-OPERATIONS-MEDUSA.md`
- `internal/docs/blueprint.md`
