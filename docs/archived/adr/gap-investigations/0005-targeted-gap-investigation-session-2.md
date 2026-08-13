# ADR-0005: Targeted gap investigation (session 2) — cart, search, contact, loading, PDP, tracking, account, admin

## Status

Accepted

## Date

2026-04-18

## Context

Follow-up targeted review of areas not fully covered in the first broad pass ([0004](./0004-broad-parallel-investigation-gaps.md)) and prior payment/parity ADRs. Evidence is from the cited storefront and admin paths.

## Findings (numbered)

### 1. Cart persists only in `sessionStorage`

`apps/storefront/src/lib/cart.ts` uses `sessionStorage` (`STORAGE_KEY`, `isBrowser`). Closing the tab clears the bag. Documented behavior may treat the bag as ephemeral until Medusa cart creation, but this diverges from typical storefront persistence (`localStorage` or server cart).

**Direction:** Evaluate `localStorage` (or hybrid) without conflicting with Medusa cart idempotency rules.

### 2. Search autocomplete omits product images

`apps/storefront/src/app/api/shop/search-suggest/route.ts` maps suggestions to `{ slug, name, minPrice }` while the underlying query can include thumbnails/images. Dropdown lacks visual confirmation vs common marketplace UX.

**Direction:** Add `imageUrl` (thumbnail or first image) to the JSON payload and render it in the suggest UI.

### 3. Contact form uses `mailto:` instead of CMS forms API

`apps/storefront/src/components/ContactSupportForm.tsx` opens `mailto:` via `window.location.href`. The storefront already implements `POST /api/forms/[formKey]` with rate limits, honeypot, Supabase persistence, and optional webhook (`apps/storefront/src/app/api/forms/[formKey]/route.ts`).

**Direction:** Submit JSON to `/api/forms/contact` (or the configured `formKey`) with the same field mapping and user feedback.

### 4. No `loading.tsx` route segments (loading UX gap)

Glob: no `apps/storefront/src/app/**/loading.tsx`. Server routes can render blank while fetching. `apps/storefront/src/app/(public)/error.tsx` exists as a client error boundary, but there is no parallel skeleton/loading hierarchy for shop, PDP, account, or track.

**Direction:** Add `loading.tsx` (skeletons) at least for `(public)/shop`, `(public)/shop/[slug]`, `(public)/account`, `(public)/track/[orderId]`.

### 5. PDP — no low-stock urgency

PDP shows binary in/out stock; Medusa exposes inventory quantities. Admin dashboard uses `available <= 5` as low-stock signal (`apps/admin/src/app/(dashboard)/admin/page.tsx`). Storefront does not surface “Only X left.”

**Direction:** Align threshold with admin policy and show copy when above zero and below threshold.

### 6. Shop filters — color swatches are generic gray

`apps/storefront/src/app/(public)/shop/page.tsx` facet color links use a fixed `bg-surface-container-highest` circle for every color name.

**Direction:** Use `cssColorForVariantColorLabel` or catalog color metadata so swatches reflect the label.

### 7. PDP — no visible breadcrumb

PDP lacks `Home > Shop > Category > Product` navigation. Hurts wayfinding and pairs with missing or incomplete `BreadcrumbList` JSON-LD (see `production-ecommerce-parity/05-jsonld-breadcrumb-pdp.md`).

### 8. PDP — no distinct “Buy now”; add-to-bag leaves PDP

`AddToCartSection` still routes to checkout after add (see `apps/storefront/src/components/AddToCartSection.tsx`). No “Buy now” fast path; overlaps conversion findings in [0004 §1](./0004-broad-parallel-investigation-gaps.md).

### 9. Product guidance — no variant guide

No `/variant-guide` (or equivalent) or PDP link. High-impact for returns and trust on the storefront.

### 10. Order tracking — no carrier deep link

`apps/storefront/src/app/(public)/track/[orderId]/page.tsx` shows tracking number and carrier slug as text; no URL to carrier track page (e.g. J&T).

**Direction:** Map `carrier_slug` to a tracking URL template + `tracking_number` query param where stable.

### 11. Order tracking — no estimated delivery

Tracking payloads can include expected delivery; not shown on the tracking page.

**Direction:** Persist `expected_delivery` (or equivalent) on order/shipment metadata and render when present.

### 12. Account — no customer order cancellation

Account order rows expose Track and Return only (`apps/storefront/src/app/(public)/account/page.tsx`). No cancel for `pending_payment` / pre-fulfillment `paid` flows.

**Direction:** Medusa-backed cancel API + eligibility rules + UI affordance.

### 13. Admin — `tasks/today` raw Medusa fetch

`apps/admin/src/app/api/admin/tasks/today/route.ts` uses `fetch` with `x-medusa-access-token` directly instead of `medusaAdminFetch`, risking drift on auth/header changes.

**Direction:** Route all admin Medusa HTTP through the shared helper.

### 14. Admin — no bulk fulfillment

`docs/privacy-terms.md` (Fulfillment Hub) describes bulk label print and bulk mark shipped. Orders hub lacks bulk actions; each order is individual.

**Direction:** Bulk selection + workflows aligned with Medusa fulfillments and label providers.

## Severity matrix

| # | Gap | Severity | Category |
|---|-----|----------|----------|
| 1 | Cart in `sessionStorage`, lost on tab close | High | Conversion |
| 2 | Search autocomplete without images | High | UX |
| 3 | Contact `mailto:` instead of forms API | High | Wrong integration |
| 4 | No `loading.tsx` on routes | High | Performance / UX |
| 5 | No low-stock warning on PDP | Medium | Conversion |
| 6 | Filter color swatches all gray | Medium | UX |
| 7 | No PDP breadcrumb | Medium | SEO / UX |
| 8 | Add to bag / no buy-now (PDP exit) | Medium | Conversion |
| 9 | No variant guide | Medium | Storefront |
| 10 | Tracking page no carrier URL | Medium | UX |
| 11 | No estimated delivery on tracking | Medium | UX |
| 12 | No customer order cancel | Medium | UX / Ops |
| 13 | `tasks/today` bypasses `medusaAdminFetch` | Low | Maintainability |
| 14 | No bulk fulfillment | Medium | Operations |

## Overlap and dependencies

- **0004** §1, §8, §15: cart redirect, login gate, listing quick-add — coordinate PDP/cart work.
- **production-ecommerce-parity:** breadcrumbs (05), JSON-LD fields (03–04), guest checkout (01) if cancel/cart policies change.
- **0003 PII:** contact form submissions land in Supabase; ensure retention and notices match policy.

## Consequences

1. High-severity items (1–4) affect conversion and trust first.
2. Tracking (10–11) may need provider + Medusa metadata contracts.
3. Bulk fulfillment (14) is a multi-screen admin project; depends on printer/label flows already in repo.
4. On acceptance, archive this ADR next to 0004 or merge into a single “storefront parity” bundle.

## Evidence (file pointers)

| Topic | Primary files |
|-------|----------------|
| Cart storage | `apps/storefront/src/lib/cart.ts` |
| Search suggest | `apps/storefront/src/app/api/shop/search-suggest/route.ts` |
| Contact UI | `apps/storefront/src/components/ContactSupportForm.tsx` |
| Forms API | `apps/storefront/src/app/api/forms/[formKey]/route.ts` |
| Shop filters | `apps/storefront/src/app/(public)/shop/page.tsx` |
| Add to cart | `apps/storefront/src/components/AddToCartSection.tsx` |
| Admin low-stock ref | `apps/admin/src/app/(dashboard)/admin/page.tsx` |
| Track page | `apps/storefront/src/app/(public)/track/[orderId]/page.tsx` |
| Account orders | `apps/storefront/src/app/(public)/account/page.tsx` |
| Tasks API | `apps/admin/src/app/api/admin/tasks/today/route.ts` |
| Error boundary | `apps/storefront/src/app/(public)/error.tsx` |
| Ops spec cite | `docs/privacy-terms.md` (Fulfillment Hub) |
