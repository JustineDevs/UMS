# SPEC verdict — production e-commerce parity (gaps 1–19)

Evidence: storefront, admin, Medusa sources in this workspace. Checklist is the user-supplied gap list. **Strict IMPLEMENTED** requires code, primary path, and validation.

---

## Guest checkout (email-only without account)

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** `apps/storefront/src/app/(public)/checkout/checkout-client.tsx` returns a sign-in gate when `authStatus !== "authenticated"` or `!session?.user`, with no guest path.

**Missing For Completion:** Medusa cart update with `email` for guests; relax profile-complete gate for non-COD or gate COD only; session-less or minimal-session checkout flow; fraud and abuse controls as required.

**Validation:** unit tests: NOT DONE. integration tests: NOT DONE. e2e/runtime test: NOT DONE guest checkout journey. manual verification: NOT DONE.

**Migrations:** none required for minimal email-on-cart path

**Env / Config:** existing Medusa and storefront URLs

**Rollback:** revert checkout client and API routes; restore auth-only gate

---

## Product URLs in sitemap

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** `apps/storefront/src/app/sitemap.ts` emits static paths plus CMS pages and posts via `loadCmsSitemapEntries()`. No product slug iteration.

**Missing For Completion:** `fetchAllProductSlugs()` (or paginated Medusa list) and `/shop/${slug}` entries with `lastModified` from product `updated_at`.

**Validation:** unit tests: NOT DONE. integration: NOT DONE. manual: curl sitemap and assert product URLs exist.

**Migrations:** none

**Env / Config:** `NEXT_PUBLIC_SITE_URL`, Medusa access for sitemap generation

**Rollback:** remove dynamic product URLs from sitemap builder

---

## Product JSON-LD availability dynamic

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `buildJsonLdProduct` in `apps/storefront/src/lib/seo.ts`

**Behavior Implemented:** `offers.availability` is always `https://schema.org/InStock`.

**Missing For Completion:** Pass stock or sellable flag from PDP data; emit `InStock`, `OutOfStock`, or `LimitedAvailability` per inventory.

**Validation:** unit tests for `buildJsonLdProduct` given stock edge cases. manual: Rich Results test tool.

**Migrations:** none

**Env / Config:** none

**Rollback:** revert `seo.ts` signature and call sites

---

## Product JSON-LD required fields (sku, brand, priceValidUntil, aggregateRating)

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `buildJsonLdProduct` in `apps/storefront/src/lib/seo.ts`

**Behavior Implemented:** Product JSON-LD includes name, url, description, image, category, offers with price and currency only.

**Missing For Completion:** `sku` from variant; `brand`; `priceValidUntil`; `aggregateRating` from `summarizeProductReviews` or equivalent.

**Validation:** unit tests for JSON-LD shape. Google Rich Results validation.

**Migrations:** none

**Env / Config:** none

**Rollback:** revert extended JSON-LD fields

---

## BreadcrumbList JSON-LD on PDP

**Status:** NOT DONE

**Scope Match:** PARTIAL

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `buildJsonLdBreadcrumb` exists in `apps/storefront/src/lib/seo.ts`; PDP layout does not emit it.

**Behavior Implemented:** Helper `buildJsonLdBreadcrumb` in `seo.ts`.

**Missing For Completion:** Serialize breadcrumb JSON-LD on `apps/storefront/src/app/(public)/shop/[slug]/page.tsx` (or shared PDP component) with Home, category, product.

**Validation:** manual Rich Results test. e2e: optional snapshot of script tag.

**Migrations:** none

**Env / Config:** none

**Rollback:** remove script from PDP

---

## rel=prev / rel=next on paginated shop

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** `apps/storefront/src/app/(public)/shop/page.tsx` uses offset pagination in query; static `metadata` export cannot vary by `searchParams` without `generateMetadata`.

**Missing For Completion:** `generateMetadata` (or route segment pattern) that sets `alternates` or `other: { prev, next }` from current offset and page size.

**Validation:** manual view-source on page 2 and 3. Lighthouse SEO checks.

**Migrations:** none

**Env / Config:** none

**Rollback:** remove dynamic link tags

---

## Canonical URL for filtered shop URLs

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** `metadata.alternates.canonical` is fixed to `canonicalUrl("/shop")` while the page renders filtered results from `searchParams`.

**Missing For Completion:** When any filter param is active, set canonical to unfiltered `/shop` (or chosen policy) via `generateMetadata` reading `searchParams`.

**Validation:** manual URL with query string shows canonical to `/shop`. Search Console hygiene.

**Migrations:** none

**Env / Config:** none

**Rollback:** revert generateMetadata

---

## Hosted payment capture, cancel, refund payment APIs

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `capturePayment`, `cancelPayment`, `refundPayment`, etc. in `apps/medusa/src/modules/xendit-payment/service.ts`

**Behavior Implemented:** Methods return `{ data: input.data ?? {} }` without external hosted-payment HTTP calls. Stripe module implements real `refundPayment`.

**Missing For Completion:** Hosted payment refund and related API calls per provider docs; error mapping; idempotency keys.

**Validation:** unit tests with HTTP mock. sandbox refund round-trip.

**Migrations:** none

**Env / Config:** hosted payment API keys and endpoints

**Rollback:** disable the hosted payment provider or manual refund process documented

---

## Dedicated order confirmation (thank-you) page

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** `apps/storefront/src/app/(public)/checkout/use-checkout-client.ts` redirects COD success to `trackingPageUrl`. Other flows use track page and embedded completion.

**Missing For Completion:** Route such as `/checkout/confirmation/[orderId]` with order lines, totals, shipping address, payment method, and next steps; secure access (token or session).

**Validation:** e2e after test payment. manual UX review.

**Migrations:** none

**Env / Config:** `TRACKING_HMAC_SECRET` or session pattern for gated view

**Rollback:** remove route; keep track-only flow

---

## Wishlist server-side persistence

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `readRaw`, wishlist helpers in `apps/storefront/src/lib/wishlist.ts`

**Behavior Implemented:** Wishlist stored in `localStorage` under `universal_music_store_wishlist_v1`.

**Missing For Completion:** Supabase `wishlists` table (or equivalent) keyed by `medusa_customer_id`; sync on login; API routes; migrate localStorage on sign-in.

**Validation:** integration tests for API. e2e two-browser sync.

**Migrations:** new table and RLS in `packages/database`

**Env / Config:** Supabase for storefront writes

**Rollback:** drop table migration; revert to local-only

---

## Wishlist add to cart from list

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `WishlistPageClient` in `apps/storefront/src/components/WishlistPageClient.tsx`

**Behavior Implemented:** View and Remove actions per item.

**Missing For Completion:** Add to cart button resolving variant (default or picker), calling existing cart mutation utilities.

**Validation:** e2e wishlist to checkout path.

**Migrations:** none

**Env / Config:** none

**Rollback:** remove button

---

## Reviews distribution, sort, filter, helpful votes, images

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `ProductReviewsSection`, `ProductReviewsFeedClient`

**Behavior Implemented:** Average, count, list feed, and compose form in `ProductReviewsSection.tsx`.

**Missing For Completion:** Distribution chart; sort and filter controls; helpful votes persistence; review image attachments and display.

**Validation:** component tests; API tests for vote endpoints.

**Migrations:** possible columns for votes and image URLs

**Env / Config:** storage for review images if uploads

**Rollback:** remove UI features

---

## Content-Security-Policy headers

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `securityHeaders` in `apps/storefront/next.config.js` and `apps/admin/next.config.mjs`

**Behavior Implemented:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control.

**Missing For Completion:** `Content-Security-Policy` appropriate for Stripe, PayPal, Supabase, Medusa, image CDNs; nonce or hash strategy for inline if needed.

**Validation:** CSP evaluator tools; checkout and admin smoke with CSP report-only phase first.

**Migrations:** none

**Env / Config:** none

**Rollback:** remove CSP header entry

---

## Checkout promo or discount code (Medusa promotions)

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** Loyalty points input in `checkout-client.tsx`. No promotion code field wired to Medusa promotions API.

**Missing For Completion:** UI field; `POST /store/carts/:id/promotions` or equivalent SDK; error handling for invalid codes.

**Validation:** e2e with test promotion. unit tests for apply/remove.

**Migrations:** none

**Env / Config:** Medusa promotion seeds in test

**Rollback:** hide field

---

## Back-in-stock email capture

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** No `restock` or `notify` flow found in storefront grep.

**Missing For Completion:** OOS UI on PDP; email or account subscription; worker or subscriber on inventory increase; deduplication.

**Validation:** integration test inventory event triggers email mock.

**Migrations:** table for subscriptions**Env / Config:** Resend or mailer

**Rollback:** remove feature flag and routes

---

## Rich branded order confirmation email

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `buildHtml` in `apps/medusa/src/subscribers/order-placed-resend-email.ts`; `buildReceiptHtml` path in `order-placed-digital-receipt.ts`

**Behavior Implemented:** Minimal HTML with order number and tracking link; separate digital receipt HTML path.

**Missing For Completion:** React Email template with line items, prices, totals, shipping address, estimated delivery, branding; wire to Resend.

**Validation:** snapshot test HTML; send test in staging.

**Migrations:** none

**Env / Config:** Resend keys existing

**Rollback:** revert template

---

## Resend idempotency key for order confirmation email

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `orderPlacedResendEmail` subscriber; `sendResendTransactionalEmail` call

**Behavior Implemented:** `sendResendTransactionalEmail` invoked without `idempotencyKey` in `order-placed-resend-email.ts`.

**Missing For Completion:** Stable key such as `order-confirmation/${orderId}` passed into mail helper; verify helper supports Resend idempotency header.

**Validation:** unit test subscriber calls with key; double-fire integration test sends once.

**Migrations:** none

**Env / Config:** none

**Rollback:** remove key argument

---

## Admin bulk order operations

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** Orders hub lacks bulk mark-shipped, bulk print, bulk status change (per gap report).

**Missing For Completion:** Multi-select UI; batch Medusa Admin API calls; permission checks; progress and failure reporting.

**Validation:** e2e bulk action on fixture orders.

**Migrations:** none

**Env / Config:** none

**Rollback:** remove bulk UI

---

## Shop listing ISR or caching (not force-dynamic only)

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `apps/storefront/src/app/(public)/shop/page.tsx`

**Behavior Implemented:** `export const dynamic = "force-dynamic"`. PDP uses `revalidate = 120` in `[slug]/page.tsx`.

**Missing For Completion:** `revalidate` on shop base listing, or split static shell with client facets; cache tags for catalog invalidation from admin mutations.

**Validation:** load test before and after. verify stale time acceptable.

**Migrations:** none

**Env / Config:** none

**Rollback:** restore force-dynamic

---

## Final Verdict

**Checklist Items:**

- Implemented: 0
- Blocked: 0
- Not Done: 19

**Spec Drift Detected:** No (this list is the binding checklist for this document).
