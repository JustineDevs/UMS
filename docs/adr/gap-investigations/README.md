# Gap investigation ADRs

**All gap investigation ADRs (0004–0009) have been implemented and archived.**

See [`docs/archived/adr/gap-investigations/`](../../archived/adr/gap-investigations/) for the accepted records.

**Master quote / handoff scope:** [Universal Music Store spec](../../spec.md)

## Summary of implemented items

| ADR | Focus | Status |
|-----|--------|--------|
| 0004 | Broad storefront + admin (cart localStorage, robots.txt, skip-to-main, JSON-LD, pagination SEO, analytics) | Accepted |
| 0005 | Contact form → forms API, loading.tsx skeletons, low-stock UX, color swatches, carrier links, cancellation | Accepted |
| 0006 | FAQ CMS-driven, store name env, tasks/today → medusaAdminFetch, terminal CORS, VAT display | Accepted |
| 0007 | Newsletter API + form, analytics events (addToCart/checkout/purchase), share button, variant guide, maintenance mode | Accepted |
| 0008 | Barangay in schema, delivery instructions, compare-at price mapping, order confirmation page | Accepted |
| 0009 | Production verification checklist — all actionable code items implemented | Accepted |

Bundled implementation specs live under [`../production-hardening/`](../production-hardening/README.md) and [`../production-ecommerce-parity/`](../production-ecommerce-parity/README.md).
