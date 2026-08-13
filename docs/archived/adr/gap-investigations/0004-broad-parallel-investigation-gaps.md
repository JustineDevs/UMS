# ADR-0004: Broad parallel investigation — storefront and admin untouched angles

## Status

Accepted

## Date

2026-04-18

## Context

A follow-up audit was run in parallel across conversion, UX, SEO, security, performance, and compliance. Earlier audits covered payments, Medusa SDK usage, and bundled parity items in `production-ecommerce-parity` and `production-hardening`. This ADR records **additional gaps** and **concrete file evidence** not fully captured there, or that restate priority with new citations.

## Findings (numbered)

### 1. Add to cart — immediate redirect, no mini cart

`handleAddToBag` in `apps/storefront/src/components/AddToCartSection.tsx` calls `addCartLine` then `router.push("/checkout")`. There is no cart drawer, mini cart, or toast; the user leaves the PDP immediately.

**Production expectation:** Stay on the product page; open a drawer or toast; allow multi-item browsing.

### 2. Add to cart — requires login before adding

Same handler: unauthenticated users are sent to `/sign-in?callbackUrl=...` and never receive a guest line item in cart storage. Combined with lack of guest checkout (see `production-ecommerce-parity/01-guest-checkout.md`), this creates a high-friction path.

### 3. No dedicated order confirmation page

After COD or hosted payment completion, flows redirect to `/track/[orderId]` (see `use-checkout-client.ts` COD branch). There is no `/order-confirmation` (or equivalent) with line items, totals breakdown, address, payment method, and “what happens next.”

**Related plan:** `production-ecommerce-parity/09-order-confirmation-page.md`

### 4. Tracking page is not a confirmation experience

`apps/storefront/src/app/(public)/track/[orderId]/page.tsx` emphasizes status and resume-checkout messaging. It does not show a full post-purchase summary (order items, unit prices, totals breakdown, shipping address, payment method, “what happens next” guidance).

### 5. Sitemap — product URLs missing

`apps/storefront/src/app/sitemap.ts` emits static paths and CMS entries only. Medusa product URLs (`/shop/[slug]`) are not included, limiting discoverability.

**Related plan:** `production-ecommerce-parity/02-sitemap-product-urls.md`

### 6. robots.txt — `/checkout` not disallowed (tracking also uncrawlable policy gap)

`apps/storefront/src/app/robots.ts` disallows `/api/` and `/account` but not `/checkout` or `/track/`, so crawlers may fetch those routes.

### 7. Product JSON-LD — incomplete for Shopping rich results

`apps/storefront/src/lib/seo.ts` (`buildJsonLdProduct`): `availability` is fixed to `InStock`; missing or incomplete vs guidelines: `sku`, `brand`, `aggregateRating`, `priceValidUntil`, and breadcrumb graph.

**Related plans:** `production-ecommerce-parity/03-jsonld-product-availability.md`, `04-jsonld-product-schema-fields.md`, `05-jsonld-breadcrumb-pdp.md`

### 8. Shop pagination — no `rel="prev"` / `rel="next"`

Offset pagination on the shop listing does not emit serial link relations for crawlers.

**Related plan:** `production-ecommerce-parity/06-shop-pagination-link-rel.md`

### 9. Filtered shop URLs — canonical

`/shop?category=...&color=...` should canonicalize to `/shop` (or a defined policy) to avoid duplicate indexable URLs.

**Related plan:** `production-ecommerce-parity/07-shop-filtered-canonical.md`

### 10. Account — reorder, invoice, order filters

`apps/storefront/src/app/(public)/account/page.tsx` order history lists Track and Return; missing reorder, downloadable invoice/receipt, status/date filters, and order number search.

### 11. Admin staff permissions cache — in-process TTL

`apps/admin/src/lib/auth.ts`: `staffSnapshotCache` is a `Map` with 60s TTL. On multi-instance serverless (e.g. Vercel), revocation can lag per instance until TTL expires.

**Remediation direction:** distributed cache (e.g. Upstash Redis already used for storefront rate limiting) or stricter invalidation and shorter TTL.

### 12. Storefront rate limit — in-memory fallback

`apps/storefront/src/lib/storefront-api-rate-limit.ts`: without `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, limits are per-instance `Map` buckets.

**Remediation:** require Upstash in production deployments so limits are global.

### 13. Staff auth — no MFA

Admin uses Google OAuth and `ADMIN_ALLOWED_EMAILS`; no TOTP/WebAuthn second factor for staff. Compromised IdP session implies full admin access until revoked in Supabase.

### 14. Shop listing — `force-dynamic`, PDP partial static strategy

`apps/storefront/src/app/(public)/shop/page.tsx` uses `export const dynamic = "force-dynamic"`. PDP uses `revalidate = 120` but without `generateStaticParams`, first-hit SSR behavior dominates at scale.

**Related plan:** `production-ecommerce-parity/19-shop-listing-isr.md`

### 15. Listing quick-add and email / PDPA preferences

- **Product cards:** Listing UI requires navigating to PDP to add items; no quick-add on card (conversion gap).
- **Email compliance:** Preferences surface exists (`PreferencesControls`, link to `/preferences`) but explicit marketing opt-out and transactional email preference management for PDPA-style consent should be verified end-to-end.

**Related context:** `docs/archived/adr/0003-pii-handling-and-data-boundaries.md`

## Severity matrix (from investigation)

| # | Gap | Severity | Category |
|---|-----|----------|----------|
| 1 | Add to cart redirects immediately to checkout | Critical | Conversion |
| 2 | Add to cart requires login | Critical | Conversion |
| 3 | No order confirmation page | High | UX |
| 4 | Tracking page lacks confirmation-style detail | High | UX |
| 5 | Product pages missing from sitemap | High | SEO |
| 6 | `/checkout` not disallowed in robots (extend to `/track/`) | High | SEO / Privacy |
| 7 | Product JSON-LD gaps | High | SEO |
| 8 | No `rel="prev/next"` | Medium | SEO |
| 9 | No canonical for filtered shop | Medium | SEO |
| 10 | Account missing reorder, invoice, filters | Medium | UX |
| 11 | Permissions cache in-memory | Medium | Security |
| 12 | Rate limit in-process fallback | Medium | Security |
| 13 | No staff MFA | Medium | Security |
| 14 | Listing `force-dynamic` / PDP static strategy | Medium | Performance |
| 15 | No listing quick-add; weak email marketing / PDPA prefs | Medium | Conversion / Compliance |

## Overlap with existing parity ADRs

Several rows already have scoped plans under `docs/adr/production-ecommerce-parity/`. This ADR does not replace those; it **consolidates citations** and adds **admin**, **rate-limit**, **MFA**, **listing quick-add**, and **robots/sitemap** emphasis where the parity bundle split topics by file.

## Consequences

1. Prioritize Critical items (1–2) with `01-guest-checkout.md` and cart UX work.
2. SEO and robots/sitemap fixes can proceed in parallel with parity items 02–07.
3. Security items (11–13 in the matrix) need architecture choice (Redis namespace for admin, env enforcement for Upstash, MFA provider).
4. When items are accepted and shipped, either move this file to `docs/archived/adr/` or split into child ADRs and mark this superseded.

## Evidence (file pointers)

| Topic | Primary files |
|-------|----------------|
| Add to cart | `apps/storefront/src/components/AddToCartSection.tsx` |
| COD / redirect | `apps/storefront/src/app/(public)/checkout/use-checkout-client.ts` |
| Track page | `apps/storefront/src/app/(public)/track/[orderId]/page.tsx` |
| Sitemap | `apps/storefront/src/app/sitemap.ts` |
| Robots | `apps/storefront/src/app/robots.ts` |
| JSON-LD | `apps/storefront/src/lib/seo.ts` |
| Shop listing | `apps/storefront/src/app/(public)/shop/page.tsx` |
| PDP revalidate | `apps/storefront/src/app/(public)/shop/[slug]/page.tsx` |
| Account | `apps/storefront/src/app/(public)/account/page.tsx` |
| Admin auth cache | `apps/admin/src/lib/auth.ts` |
| Rate limit | `apps/storefront/src/lib/storefront-api-rate-limit.ts` |
