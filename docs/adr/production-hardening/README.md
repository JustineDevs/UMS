# Production hardening ADRs (checklist 1–26)

**Status:** Proposed (planning artifacts; not accepted architecture decisions until review.)

This folder holds **one ADR-style plan per checklist item** from the production-hardening map, plus a machine-readable **spec verdict**.

| File | Checklist # | Tier |
|------|-------------|------|
| [01-product-editor-catalog.md](../../archived/adr/production-hardening/01-product-editor-catalog.md) | 1 | T1 |
| [02-terminal-agent-pos-bridge.md](../../archived/adr/production-hardening/02-terminal-agent-pos-bridge.md) | 2 | T1 |
| [03-admin-pos-page.md](../../archived/adr/production-hardening/03-admin-pos-page.md) | 3 | T1 |
| [04-compliance-anonymize-pii.md](../../archived/adr/production-hardening/04-compliance-anonymize-pii.md) | 4 | T1 |
| [05-payment-recovery-cron.md](../../archived/adr/production-hardening/05-payment-recovery-cron.md) | 5 | T1 |
| [06-fulfillment-panel.md](../../archived/adr/production-hardening/06-fulfillment-panel.md) | 6 | T2 |
| [07-checkout-client-payment-path.md](../../archived/adr/production-hardening/07-checkout-client-payment-path.md) | 7 | T2 |
| [08-storefront-home-cms.md](../../archived/adr/production-hardening/08-storefront-home-cms.md) | 8 | T2 |
| [09-cms-page-blocks-editor.md](../../archived/adr/production-hardening/09-cms-page-blocks-editor.md) | 9 | T2 |
| [10-loyalty-admin-surface.md](../../archived/adr/production-hardening/10-loyalty-admin-surface.md) | 10 | T2 |
| [11-devices-registry.md](../../archived/adr/production-hardening/11-devices-registry.md) | 11 | T2 |
| [12-cms-experiments.md](../../archived/adr/production-hardening/12-cms-experiments.md) | 12 | T3 |
| [13-campaigns-medusa-promotions.md](../../archived/adr/production-hardening/13-campaigns-medusa-promotions.md) | 13 | T3 |
| [14-crm-client-enhancements.md](../../archived/adr/production-hardening/14-crm-client-enhancements.md) | 14 | T3 |
| [15-chat-intake-form.md](../../archived/adr/production-hardening/15-chat-intake-form.md) | 15 | T3 |
| [16-account-profile-panel.md](../../archived/adr/production-hardening/16-account-profile-panel.md) | 16 | T3 |
| [17-sdk-i18n.md](../../archived/adr/production-hardening/17-sdk-i18n.md) | 17 | T3 |
| [18-admin-api-staff-guard-redaction.md](../../archived/adr/production-hardening/18-admin-api-staff-guard-redaction.md) | 18 | T4 |
| [19-paypal-webhook-production.md](../../archived/adr/production-hardening/19-paypal-webhook-production.md) | 19 | T4 |
| [20-channel-webhook-secret-policy.md](../../archived/adr/production-hardening/20-channel-webhook-secret-policy.md) | 20 | T4 |
| [21-supabase-service-role-rotation.md](../../archived/adr/production-hardening/21-supabase-service-role-rotation.md) | 21 | T4 |
| [22-loyalty-balance-sync-contract.md](../../archived/adr/production-hardening/22-loyalty-balance-sync-contract.md) | 22 | T5 |
| [23-digital-receipts-pos-voids-medusa-id.md](../../archived/adr/production-hardening/23-digital-receipts-pos-voids-medusa-id.md) | 23 | T5 |
| [24-cart-abandonment-recovery-dedup.md](../../archived/adr/production-hardening/24-cart-abandonment-recovery-dedup.md) | 24 | T5 |
| 25 | Redacted archived payment-provider E2E plan | T6 |
| [26-ci-strict-e2e-release-gate.md](../../archived/adr/production-hardening/26-ci-strict-e2e-release-gate.md) | 26 | T6 |

- Full **ZSPS / spec** verdict: [SPEC-VERDICT.md](./SPEC-VERDICT.md) (includes **Revision 2** false-positive `TODO` note)
- **Corrected audit + OSS gap roadmap:** [CORRECTED-AUDIT-AND-OSS-GAPS.md](./CORRECTED-AUDIT-AND-OSS-GAPS.md)

Parent ADR policy: [../README.md](../README.md)
