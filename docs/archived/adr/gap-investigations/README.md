# Gap investigation ADRs (proposed)

**Master quote / handoff scope (all sections, tiers):** [Universal Music Store spec](../../../spec.md) — includes the as-built verification snapshot so vendors do not re-quote completed payment and checkout items.

Numbered ADRs that record parallel gap passes across storefront, admin, finance, and ops. **Status: Proposed** until reviewed and moved to `docs/archived/adr/` per [ADR policy](../../README.md).

| ADR | Focus |
|-----|--------|
| [0004](./0004-broad-parallel-investigation-gaps.md) | Broad storefront + admin (cart, SEO, account, MFA, listing) |
| [0005](./0005-targeted-gap-investigation-session-2.md) | Targeted session 2 (persistence, search, contact, PDP, tracking, admin) |
| [0006](./0006-gap-investigation-round-4-finance-pos-security-ops.md) | Finance reconciliation, POS tax, env defaults, ledger, FAQ CMS, terminal CORS |
| [0007](./0007-gap-investigation-round-5-marketing-compliance-ux.md) | Meta/GA4 gaps, newsletter, cookies, a11y skip link, sale price, feeds, SMS, maintenance |
| [0008](./0008-gap-investigation-round-6-stakeholder-intake-ph-pos-checkout.md) | Intake §15 vs code: shipping zones, pre-order, POS QR/customer/discount, barangay, `/cart`, checkout steps |
| [0009](./0009-critical-production-verification-checklist.md) | Launch gate checklist: PH logistics, payments, POS, notifications, hardening, legal — with codebase-verified statuses |

Read in order: **0004 → 0005 → 0006 → 0007 → 0008 → 0009**. Cross-links between files use relative paths in this folder.

Bundled checklists (implementation specs) live under [`docs/adr/production-hardening/`](../../../adr/production-hardening/README.md) and [`docs/adr/production-ecommerce-parity/`](../../../adr/production-ecommerce-parity/README.md).
