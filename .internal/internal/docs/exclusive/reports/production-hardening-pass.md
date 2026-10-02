# Production Hardening Pass Report

Date: 2026-03-24 (updated 2026-03-26: storefront + admin RBAC strict mode; see `storefront-admin-production-audit-2026-03-26.md`)
Scope: Full monorepo (storefront, admin, medusa, api, packages)

---

## Executive Summary

The Universal Music Store Platform is functional at the integration level. Storefront, Admin, POS, and Medusa are wired together. The core checkout flow, order management, and inventory pipelines work through Medusa. Auth is properly separated (admin = staff, storefront = customer). Multiple payment providers are conditionally loaded.

Verdict: **Conditionally Ready** for controlled user onboarding. Critical build failures and security issues have been fixed in this pass. Medium-priority items remain.

---

## Hardening Findings Log

| ID | Source | Component | Severity | Description | Fix Status |
|----|--------|-----------|----------|-------------|------------|
| H-001 | Build | Admin | Critical | TypeScript build fails: `NextRequest` not assignable to `NextRequestWithAuth` in middleware | FIXED |
| H-002 | Build | Medusa | Critical | `medusa build` fails with `Cannot read properties of null (reading 'admin')` due to missing admin config | FIXED |
| H-003 | Security | Storefront | Critical | Tracking page allows token-less access when `TRACKING_HMAC_SECRET` is unset, even in production | FIXED |
| H-004 | Code Quality | Storefront | High | `cart.ts` JSON.parse without try/catch crashes on corrupt sessionStorage | FIXED |
| H-005 | Code Quality | Storefront | High | `canonicalUrl()` in seo.ts strips `://` from URLs via bad regex | FIXED |
| H-006 | Data | POS + Checkout | High | Hardcoded 8.5% tax rate (incorrect PH VAT). Philippines standard VAT is 12% | FIXED |
| H-007 | UX | POS | High | `alert()` used for order success/failure feedback instead of proper UI | FIXED |
| H-008 | CI | Root | High | `security-audit.yml` uses pnpm 9, repo uses pnpm 10. Version drift causes lockfile mismatches | FIXED |
| H-009 | Code Quality | Root | High | `package-lock.json` alongside `pnpm-lock.yaml` creates confusion. Two package managers | FIXED (deleted) |
| H-010 | Build | Storefront | Medium | 6 ESLint warnings: unused `locked`, `image`, `_revalidate` params | FIXED |
| H-011 | Code Quality | Storefront | Medium | Deprecated `startMedusaLemonCheckout` function never imported anywhere | FIXED (removed) |
| H-012 | Code Quality | Admin | Medium | `next-auth.d.ts` module augmentation triggers false ESLint unused-vars warnings | FIXED |
| H-013 | Config | Root | Medium | ESLint `no-unused-vars` does not exempt underscore-prefixed params | FIXED |
| H-014 | Config | Root | Medium | `.gitignore` missing `.medusa/` build output dir and `package-lock.json` | FIXED |
| H-015 | UX | POS | Medium | False status indicators "Scanner Online" and "Printer Ready" show green for hardware not connected | FIXED |
| H-016 | UX | Admin | Medium | Permission denial redirects to `/admin` with no feedback to user | FIXED |
| H-017 | Error Handling | Admin | Medium | Missing `error.tsx` and `not-found.tsx` boundary pages | FIXED |
| H-018 | Auth | Admin | Low | Session callback queries Supabase on every request for fresh permissions. Works but adds latency | DEFERRED (acceptable tradeoff) |
| H-019 | Wiring | Storefront | Medium | Account page shows static "No orders yet" with no Medusa customer order fetch | DEFERRED |
| H-020 | Wiring | Storefront | Low | Preferences page is static copy only with no functional controls | DEFERRED |
| H-021 | Wiring | Storefront | Low | Wishlist is device-local only (sessionStorage), not persisted to backend | DEFERRED |
| H-022 | Security | Medusa | Medium | Maya payment webhook has no HMAC signature verification (relies on IP allowlist per comment) | DEFERRED |
| H-023 | Security | Medusa | Medium | PayPal `getWebhookActionAndData` returns `NOT_SUPPORTED`. No webhook-driven payment completion | DEFERRED |
| H-024 | Testing | Medusa | Medium | `test:unit` and `test:integration:modules` configured but zero matching test files exist | DEFERRED |
| H-025 | Observability | Medusa | Low | OpenTelemetry instrumentation is commented out | DEFERRED |
| H-026 | Wiring | Admin | Low | Chat intake form always sends `items: []`, never creates Medusa draft from form | DEFERRED |
| H-027 | Architecture | Medusa | Low | No custom workflows in `src/workflows/` beyond README placeholder | INFO |
| H-028 | Data | Both | Low | Tax calculation in storefront/POS is display-only. Medusa owns real totals at payment time | INFO |
| H-029 | Security | platform-data / admin | High | RBAC was fail-open when `permissions` was empty or `staff_permission_grants` had no rows | FIXED (`NEXT_PUBLIC_STAFF_RBAC_STRICT` + `isStaffRbacStrictEnv()`, 2026-03-26) |

---

## Changes Made in This Pass

### Critical Fixes
1. **Admin middleware TypeScript error** (H-001): Cast `authMiddleware` call to resolve `NextRequestWithAuth` type mismatch.
2. **Medusa build config** (H-002): Added `admin` section to `medusa-config.ts` with `backendUrl` from env.
3. **Tracking token bypass** (H-003): Restricted legacy no-token access to development mode only.

### High Fixes
4. **Cart JSON.parse safety** (H-004): Wrapped in try/catch, clears corrupt storage on parse failure.
5. **canonicalUrl regex** (H-005): Preserved protocol `://` when collapsing duplicate slashes.
6. **PH VAT rate** (H-006): Changed from 8.5% to 12% in both POS and checkout pages.
7. **POS alert() removal** (H-007): Replaced with state-based success/error messages in the UI.
8. **CI pnpm version** (H-008): Updated `security-audit.yml` from pnpm 9 to pnpm 10.
9. **Dual lockfile** (H-009): Deleted `package-lock.json`, added to `.gitignore`.

### Medium Fixes
10. **ESLint warnings** (H-010): Removed unused `_revalidate` params and their call-site arguments. Fixed `locked` param rename. Fixed unused `image` variable in seo.ts.
11. **Dead code** (H-011): Removed deprecated `startMedusaLemonCheckout`.
12. **ESLint config** (H-013): Added `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"` to `no-unused-vars`.
13. **.gitignore** (H-014): Added `.medusa/`, `package-lock.json`, `yarn.lock`.
14. **POS indicators** (H-015): Removed misleading hardware status indicators.
15. **Permission denied UX** (H-016): Added `?denied=` query param to redirect, displayed as banner on dashboard.
16. **Error boundaries** (H-017): Added `error.tsx` and `not-found.tsx` to admin app.
17. **Type augmentation lint** (H-012): Added eslint-disable for `next-auth.d.ts`.

---

## Architecture Assessment

### What Works
- Medusa is the single source of truth for commerce (products, carts, orders, payments).
- Payment providers load conditionally based on env. COD is always available.
- Admin uses BFF pattern (Route Handlers call Medusa Admin API).
- Auth is split: admin uses staff roles from Supabase, storefront uses plain Google OAuth.
- Webhook handlers for Lemon Squeezy, Paymongo, and AfterShip verify HMAC signatures.
- Webhook dedup tables prevent double-processing.
- Shared packages (`sdk`, `types`, `validation`, `platform-data`) reduce duplication.
- Release gate script runs lint, build, security, audit, and tests.

### What Needs Work (Deferred)
- Account page order history is not wired to Medusa.
- Maya webhook lacks HMAC verification.
- PayPal webhooks are unsupported.
- Medusa unit/module test coverage is zero.
- OpenTelemetry is disabled.
- Chat intake form sends empty items array.

---

## Prioritized Action List (Next Steps)

| Priority | Action | Scope | Effort |
|----------|--------|-------|--------|
| 1 | Wire account order history to Medusa Store API | storefront/account | M |
| 2 | Add Maya webhook HMAC verification | medusa/maya-payment | S |
| 3 | Add PayPal webhook handler or document limitation | medusa/paypal-payment | M |
| 4 | Add Medusa unit tests for payment modules | medusa/src/modules | L |
| 5 | Enable OpenTelemetry instrumentation | medusa/instrumentation | S |
| 6 | Add rate limiting to admin BFF routes | admin/api | M |
| 7 | Add E2E test for checkout happy path | e2e | L |
| 8 | Cache admin session permissions (TTL 60s) | admin/auth | S |
| 9 | Wire chat intake form items field | admin/chat-intake | S |
| 10 | Add health endpoint to admin app | admin/api/health | S |

---

## Files Changed

- `apps/admin/src/middleware.ts`
- `apps/admin/src/types/next-auth.d.ts`
- `apps/admin/src/lib/require-page-permission.ts`
- `apps/admin/src/app/(dashboard)/admin/page.tsx`
- `apps/admin/src/app/(dashboard)/admin/pos/page.tsx`
- `apps/admin/src/app/not-found.tsx` (new)
- `apps/admin/src/app/error.tsx` (new)
- `apps/medusa/medusa-config.ts`
- `apps/storefront/src/lib/cart.ts`
- `apps/storefront/src/lib/seo.ts`
- `apps/storefront/src/lib/catalog-fetch.ts`
- `apps/storefront/src/lib/medusa-checkout.ts`
- `apps/storefront/src/app/(public)/page.tsx`
- `apps/storefront/src/app/(public)/shop/page.tsx`
- `apps/storefront/src/app/(public)/shop/[slug]/page.tsx`
- `apps/storefront/src/app/(public)/collections/page.tsx`
- `apps/storefront/src/app/(public)/checkout/page.tsx`
- `apps/storefront/src/app/(public)/track/[orderId]/page.tsx`
- `apps/storefront/src/components/SmoothScrollProvider.tsx`
- `eslint.config.mjs`
- `.gitignore`
- `.github/workflows/security-audit.yml`
- `package-lock.json` (deleted)

---

## Ship Decision

**Conditionally Ready.** The admin and storefront will build cleanly after these fixes. Medusa build requires `DATABASE_URL` and CORS env to be set (expected for any deployment). The system is safe for controlled onboarding with the following conditions:

1. Set `TRACKING_HMAC_SECRET` in production (tracking is now blocked without it).
2. Set all required Medusa env vars per `apps/medusa/.env.template`.
3. Maya payment provider should only be enabled in production after adding HMAC verification.
4. PayPal provider works for creating orders/captures but has no webhook completion path.
