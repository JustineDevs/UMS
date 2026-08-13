# ADR-0007: Gap investigation round 5 — marketing stack, compliance, conversion UX

## Status

Accepted

## Date

2026-04-18

## Context

Fifth parallel pass after [0004](./0004-broad-parallel-investigation-gaps.md), [0005](./0005-targeted-gap-investigation-session-2.md), and [0006](./0006-gap-investigation-round-4-finance-pos-security-ops.md). This ADR records **new gaps** confirmed against the codebase, plus a short **non-gap** list (features suspected missing but present).

## Confirmed present (not gaps)

| Area | Evidence |
|------|----------|
| Product image zoom (lightbox, Escape, scroll lock, dialog semantics) | `apps/storefront/src/components/ProductImageZoom.tsx` |
| PDP gallery video (YouTube iframe, hosted HTML5) | `apps/storefront/src/components/ProductGalleryCarousel.tsx` (`VideoSlide`) |
| Quick view on cards | `apps/storefront/src/components/QuickViewButton.tsx`, `ProductQuickViewModal.tsx`, wired from `CatalogProductCard.tsx` |
| Cart merge on login | `apps/storefront/src/app/api/cart/merge/route.ts` |
| Staff audit logging | `apps/admin/src/lib/staff-audit.ts` (`insertStaffAuditLog` → `audit_logs`) |

## Findings (numbered)

### 1. Analytics — Vercel Web Analytics only; no Meta Pixel, GA4, or TikTok

`apps/storefront/src/lib/analytics.ts` emits `product_click` and `product_view` only when `window.va` exists. There is no `gtag`, GA4 measurement ID wiring, `fbq`, or TikTok pixel in the storefront tree.

**Impact:** No standard ad conversion signals, retargeting audiences, or ROAS from site events for Meta-heavy acquisition.

### 2. Newsletter signup — no first-party API; home form non-functional

- **CMS block:** `apps/storefront/src/components/CmsBlocksRenderer.tsx` (`case "newsletter"`) submits via GET to optional `actionUrl` from CMS props. If unset, UI tells staff to configure URL. There is no `apps/storefront/src/app/api/**/newsletter` route in-repo.
- **Home scroll experience:** `apps/storefront/src/components/home/HomeScrollExperience.tsx` — `<form>` has no `action`, no `onSubmit`, no route handler. Submits nowhere.

**Impact:** No guaranteed list growth, Resend audience sync, or double opt-in without external form URLs.

### 3. Cookie consent — static `/cookies` page only; no consent gate

No cookie banner or consent manager component is wired in `RootLayout` or `StorefrontPublicChrome`. Session and analytics scripts load without a documented consent flow.

**Note:** Legal characterization (PDPA “non-essential” scope) is for counsel; the **product gap** is absence of a consent UX and categorization of scripts.

### 4. Skip to main content — missing (WCAG 2.1 A baseline)

`apps/storefront/src/app/layout.tsx` and `StorefrontPublicChrome` do not render a skip link. No `id="main-content"` (or equivalent) target verified on public shell for keyboard/AT users.

### 5. Compare-at / sale presentation — mapper forces null

`apps/storefront/src/lib/medusa-catalog-mapper.ts` sets `compareAtPrice: null` for every variant. Promotional strikethrough, “SALE” badge, and discount percentage cannot reflect Medusa sale data until mapped and rendered on cards/PDP.

### 6. Order notes / delivery instructions at checkout — not in UI

Checkout copy in `checkout-client.tsx` references “order comments” only as narrative; there is no dedicated field bound to Medusa cart/order metadata for courier instructions.

### 7. VAT-inclusive labeling on storefront — absent

POS computes display VAT (`admin/pos/page.tsx`). Storefront product surfaces show price strings without “VAT inclusive” or line-item VAT breakdown for BIR-aligned customer display expectations.

### 8. PDF invoice / receipt download — no generator or download route

No `jsPDF`, `pdf-lib`, `puppeteer`, or `@react-pdf` usage in storefront. `digital_receipts.receipt_html` is populated from Medusa (`apps/medusa/src/lib/digital-receipt.ts`, subscriber `order-placed-digital-receipt.ts`); there is no customer-facing PDF download route in the storefront.

### 9. PDP social sharing — no share UI

No Facebook/Messenger share controls, copy-link control, or `navigator.share` wrapper on PDP components.

### 10. Product feeds — no Google Shopping XML / Meta catalog JSON route

No `apps/storefront/src/app/api/feed/**` (or similar) for merchant catalog sync.

### 11. SMS / Viber order notifications — not integrated

Email path uses Resend (`packages/resend-mail`). No Semaphore, Vonage, Globe Labs, or Viber Business API wiring found for transactional SMS.

### 12. Saved payment methods — no account UI

`apps/medusa/docs/PAYMENT_VAULT.md` describes provider vaulting. Storefront account page text references cards staying with providers but offers no manage-cards UI (Stripe Customer Portal link, etc.) beyond generic copy.

### 13. Maintenance mode — no env-driven redirect

No `NEXT_PUBLIC_MAINTENANCE_MODE` (or similar) in middleware/layout to serve a maintenance page during deploys.

### 14. Pre-order and back-in-stock — storefront missing

Out-of-stock disables add-to-bag without capture flow. Parity doc exists (`docs/adr/production-ecommerce-parity/15-back-in-stock-notify.md`); storefront implementation not present in this pass.

### 15. Analytics funnel depth — no cart/checkout/purchase events

Only `trackProductClick` / `trackProductView` exist. No `trackAddToCart`, `trackBeginCheckout`, `trackPurchase`, or payment method selection events in `analytics.ts` or call sites.

## Severity matrix

| # | Gap | Severity | Category |
|---|-----|----------|----------|
| 1 | No Meta / GA4 / TikTok pixels | Critical | Marketing |
| 2 | Newsletter: no API; home form broken | High | Marketing |
| 3 | No cookie consent UX | High | Legal / compliance |
| 4 | No skip-to-main | High | Accessibility |
| 5 | Compare-at / sale not mapped | High | Conversion |
| 6 | No order / delivery notes field | High | UX (PH couriers) |
| 7 | No VAT-inclusive labeling | High | Compliance display |
| 8 | No PDF invoice download | Medium | UX |
| 9 | No PDP sharing | Medium | Marketing |
| 10 | No merchant product feeds | Medium | Marketing |
| 11 | No SMS / Viber notifications | Medium | UX |
| 12 | No saved payment UI | Medium | Conversion |
| 13 | No maintenance mode | Medium | Operations |
| 14 | No pre-order / back-in-stock | Medium | Conversion |
| 15 | Analytics lacks revenue events | Medium | Analytics |

## Consequences

1. Items 1, 2, 9, 10, 15 cluster as **measurable growth** work (attribution + catalog sync).
2. Items 3, 4, 7 are **compliance and accessibility** debt with clear UX deliverables.
3. Items 6, 8, 11, 12, 14 are **operations and post-purchase** quality.
4. Item 13 is **deploy hygiene** on Vercel (edge config, middleware, or hosting-level maintenance).

## Evidence (file pointers)

| Topic | Primary files |
|-------|----------------|
| Analytics | `apps/storefront/src/lib/analytics.ts`, `CatalogProductCard.tsx`, `ProductViewTracker.tsx` |
| Newsletter | `CmsBlocksRenderer.tsx`, `HomeScrollExperience.tsx` |
| Layout / chrome | `apps/storefront/src/app/layout.tsx`, `StorefrontPublicChrome.tsx` |
| Catalog pricing | `medusa-catalog-mapper.ts` (`compareAtPrice: null`) |
| Checkout | `checkout-client.tsx`, `use-checkout-client.ts` |
| Account | `apps/storefront/src/app/(public)/account/page.tsx` |
| Digital receipts (HTML) | `apps/medusa/src/lib/digital-receipt.ts`, `order-placed-digital-receipt.ts` |
| Vault docs | `apps/medusa/docs/PAYMENT_VAULT.md` |
| Parity back-in-stock | `docs/adr/production-ecommerce-parity/15-back-in-stock-notify.md` |
