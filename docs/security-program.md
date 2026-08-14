# Security program (operator checklist)

This document is the **live** counterpart to archived notes under `output/full-application-audit/`. It encodes what the repo enforces in CI and at boot.

## 1. Payment credentials (Medusa environment)

- **Medusa** registers payment modules from **`process.env`** at startup (`apps/medusa/medusa-config.ts`). Set `STRIPE_API_KEY`, `PAYPAL_*`, `XENDIT_*`, and webhook secrets in the Medusa deployment environment; restart Medusa after rotation.
- **Observability:** `GET /admin/payment-health` on Medusa returns which providers have env keys present (no secret values).
- **Storefront** must not bundle server-only PSP secrets (`stress-test/scripts/check-storefront-client-boundary.mjs`).
- **Payment-state reconciliation** is part of production readiness, not only credential hygiene: Supabase `payment_attempts`, server finalize routes, optional `GET /api/cron/finalize-payment-attempts` on the storefront, and staff **Payment attempts** in admin together reduce stuck orders when webhooks or browser returns fail. Treat missing cron or misconfigured `STOREFRONT_*` recovery env vars as an operational gap, not only a security gap.

## 2. Automated gates (CI and release)

| Check | Script / workflow |
| --- | --- |
| Dependency audit triage | `stress-test/scripts/check-audit-triage.js` (document highs in the active security runbook) |
| Storefront client bundle (no server secrets) | `stress-test/scripts/check-storefront-client-boundary.mjs` |
| Legacy DB migrations vs Medusa commerce tables | `stress-test/scripts/check-commerce-migration-boundary.mjs` |
| Admin API routes must show staff or internal guard patterns | `stress-test/scripts/check-admin-api-staff-guard.mjs` |
| Unit tests (incl. Medusa env validation, admin webhook policy) | `pnpm test`, `pnpm release-gate` |

GitHub Actions workflow: `.github/workflows/security-audit.yml`.

## 3. Internal and staff surfaces

- **Express** compliance and health: `INTERNAL_API_KEY` required in production (`apps/api`).
- **Admin** App Router APIs: expected to call `requireStaffSession`, `getServerSession`, or an approved internal/HMAC pattern (enforced by `check-admin-api-staff-guard.mjs`).
- **Channel webhook** (`/api/integrations/channels/webhook`): `CHANNEL_WEBHOOK_SECRET` required on Vercel production and on non-Vercel `NODE_ENV=production`; HMAC verified with constant-time compare (`channel-webhook-signature.ts`).

## 4. Ongoing work (not fully automatable)

- E2E checkout per enabled PSP and webhook deduplication (see `output/full-application-audit/gap_register.md` C1).
- Service role key for Supabase: treat as high privilege; rotate on schedule, audit access logs where available.
- Periodic RLS and rate-limit review on public storefront routes when migrations change policies.
- Secret redaction review when logging admin API errors.

Staff admin sign-in is **Google-only** on `/sign-in`. E2E credentials exist only on `/sign-in/e2e` when `NODE_ENV=development` and E2E env is set (`admin-allowed-emails.ts`).

## 5. References

- `docs/data-ownership.md` and `packages/database/src/data-boundaries.ts` for Medusa vs Supabase ownership.
- `apps/medusa/src/loaders/validate-process-env.ts` for production env rules.
