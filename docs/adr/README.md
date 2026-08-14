# Architecture Decision Records (ADRs)

**Vendor quote / full backlog scope:** [Universal Music Store spec](../spec.md)

## Policy

**Accepted** ADRs (frozen) live in [`docs/archived/adr/`](../archived/adr/). See [`docs/archived/README.md`](../archived/README.md).

**Proposed** ADRs stay under `docs/adr/` until review. Then set `Status: Accepted` and move the file to `docs/archived/adr/`.

---

## Archived — gap investigations (numbered)

Serial audit notes with severity tables and file evidence. Index: **[gap-investigations/README.md](../archived/adr/gap-investigations/README.md)**

| ADR | Summary |
|-----|---------|
| [0004](../archived/adr/gap-investigations/0004-broad-parallel-investigation-gaps.md) | Broad storefront + admin gap pass |
| [0005](../archived/adr/gap-investigations/0005-targeted-gap-investigation-session-2.md) | Targeted session 2 (cart, search, contact, PDP, admin) |
| [0006](../archived/adr/gap-investigations/0006-gap-investigation-round-4-finance-pos-security-ops.md) | PSP reconciliation, POS VAT, env defaults, FAQ CMS, terminal CORS |
| [0007](../archived/adr/gap-investigations/0007-gap-investigation-round-5-marketing-compliance-ux.md) | Pixels/feeds, newsletter API, cookie consent, skip link, sale badges, order notes, PDF, maintenance |
| [0008](../archived/adr/gap-investigations/0008-gap-investigation-round-6-stakeholder-intake-ph-pos-checkout.md) | Stakeholder intake gaps, barangay, cart page, POS payment QR, discounts, flat shipping seed, checkout checklist deltas |
| [0009](../archived/adr/gap-investigations/0009-critical-production-verification-checklist.md) | Production-ready verification checklist (verified statuses, refund/webhook/ratelimit corrections) |

---

## Active — bundled planning ADRs (checklists)

| Bundle | Contents |
|--------|----------|
| [production-hardening/](./production-hardening/README.md) | Checklist 1–26, [SPEC-VERDICT](./production-hardening/SPEC-VERDICT.md), [corrected audit / OSS gaps](./production-hardening/CORRECTED-AUDIT-AND-OSS-GAPS.md) |
| [production-ecommerce-parity/](./production-ecommerce-parity/README.md) | Consumer-commerce gaps 1–19, [SPEC-VERDICT](./production-ecommerce-parity/SPEC-VERDICT.md) |

---

## Archived — accepted bundles

| Bundle | Notes |
|--------|--------|
| [payment-system-audit/](../archived/adr/payment-system-audit/README.md) | Storefront + Medusa payment audit (accepted; frozen under `docs/archived/adr/`) |
| [production-ecommerce-parity/](../archived/adr/production-ecommerce-parity/) | Gaps 2–3–4–5–6–7–9–13–15–19 implemented and accepted |
| [production-hardening/](../archived/adr/production-hardening/) | PH-26 CI strict E2E gate (accepted) |
| [0001 data ownership](../archived/adr/0001-data-ownership.md), [0003 PII / boundaries](../archived/adr/0003-pii-handling-and-data-boundaries.md) | Single-file accepted ADRs |
