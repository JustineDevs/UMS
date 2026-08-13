# Corrected audit: grep false positives and real gaps

**Status:** Reference (not an accepted ADR)

## Why the first audit over-counted stubs

Many reported `TODO` hits came from **HTML `placeholder="..."` attributes** and strings such as **`"mock"`** (adapter name), not from unfinished logic. A literal `TODO` comment search is an unsafe proxy for production readiness on this codebase.

## Source-verified: primary staff and agent flows are wired

The following areas show **implemented request handlers and UI wiring** in the current tree (see cited paths in the investigation you supplied):

| Area | Evidence summary |
|------|-------------------|
| Terminal agent | `POST /print-receipt`, `/print-label`, `/open-drawer`, `/cloudprnt`, `/status`, `/devices` in `apps/terminal-agent/src/server.ts` |
| Catalog editor | Create/edit via `/api/admin/catalog/products` in `ProductEditorForm.tsx` |
| POS page | `handleCommitSale`, offline queue, print hooks in `apps/admin/src/app/(dashboard)/admin/pos/page.tsx` |
| Loyalty admin | Accounts, rewards, enroll, points, lookup in `loyalty/page.tsx` + admin APIs |
| Fulfillment | `addShipment`, `patchOrder` via `/api/medusa/shipments` and orders PATCH in `FulfillmentPanel.tsx` |
| Devices | CRUD and config patch in `devices/page.tsx` |
| Storefront home CMS | `getStorefrontHomeContent` / `upsertStorefrontHomeContent` in `packages/platform-data/src/storefront-home-cms.ts` |
| SDK i18n | `t`, `formatCurrency`, `formatDate`, `detectLocale`, registered `en-PH` keys in `packages/sdk/src/i18n.ts` |

**Spec implication:** checklist items that only claimed `TODO` counts for these files should be treated as **CHANGED** scope: the open work is **validation**, **checkout coupling**, or **platform ops**, not missing UI skeletons.

## Real confirmed gaps (implementation or ops)

### Gap A — Compliance anonymization (code stub)

- `anonymizeStaleOrderAddresses` in `packages/platform-data/src/compliance.ts` is a **no-op**.
- `exportDataSubjectByEmail` returns **empty** `orders`, `addresses`, `payments`; DSAR is incomplete for Medusa-held commerce data.

**Fix direction:** Supabase PII updates for owned tables + Medusa Admin API for customer or order data per legal process. No third-party OSS required for the minimum fix.

### Gap B — Loyalty has no checkout pricing effect

- Admin loyalty CRUD exists; **points do not change cart totals** at checkout.
- `docs/data-ownership.md` still requires a single balance and price-change path.

**Fix direction:** Use **Medusa Promotions** (already on `@medusajs/medusa@2.13.1`): create or apply promotion at redemption, persist `loyalty_transactions` state after paid order. No extra npm package required for the core idea.

### Gap C — Campaign execute path needs verification

- UI calls `POST /api/admin/campaigns/:id/execute` and displays `sent`.
- **Verify** the route actually sends mail (e.g. Resend) vs only updating `last_run_at`.

**Fix direction:** `packages/resend-mail` / Resend already in repo; optional **Resend Broadcasts** or external **Loops** only if product wants scheduled broadcast analytics.

### Gap D — Experiments: storefront assignment unconfirmed

- `CmsExperimentsManager` persists experiments; storefront must consume **`cms-experiment-pick`** (`packages/sdk`) per `docs/cms-experiment-storefront-keys.md`.

**Fix direction:** Finish wiring using existing SDK export, **or** adopt **GrowthBook** (MIT, Next.js SDK) if you want a full feature-flag + stats stack and retire custom `cms_experiments` later.

### Gap E — Payment recovery cron not in Vercel config

- Route `GET /api/cron/finalize-payment-attempts` is implemented; **`apps/storefront/vercel.json` has no `crons` array** (Render example exists in `render.yaml`).

**Fix direction:** Add Vercel Cron + `STOREFRONT_PAYMENT_CRON_SECRET`. **Or** use **Inngest** for durable scheduling and retries (infrastructure choice).

### Gap F — `CI_STRICT_E2E` in GitHub Actions

- **Fact check:** `.github/workflows/e2e-release-gate.yml` already sets `CI_STRICT_E2E: "1"` for `pnpm test:e2e:critical`.
- **Remaining work:** Any **other** workflow that runs checkout E2E without this env still allows silent skips. Grep `.github/workflows` and align.

### Gap G — Real-time admin inventory or orders (new)

- Supabase Realtime is available via `@supabase/supabase-js` already in admin; subscriptions not confirmed on inventory or order UIs.

**Fix direction:** `postgres_changes` channels on relevant tables; no new dependency.

### Gap H — Production error tracking (new)

- Zipkin exporter in Medusa devDeps does not replace user-facing error tracking.

**Fix direction:** **Sentry** (`@sentry/nextjs` / `@sentry/node`) or self-host **PostHog** for errors + product analytics.

### Gap I — Durable background jobs (new)

- Long webhook or campaign work in serverless routes risks timeout without retries.

**Fix direction:** **Trigger.dev** or **Inngest** for queued work with backoff and replay.

### Gap J — Edge-consistent rate limiting (new)

- `@universal-music-store/rate-limits` may not share state across all serverless instances.

**Fix direction:** **Upstash Ratelimit** + Redis for global limits in Next.js middleware or API facade.

## Priority ordering (leverage)

1. Durable jobs (Inngest or Trigger.dev) for webhooks and reconciliation
2. Sentry (or PostHog) for production errors on storefront, admin, Medusa
3. Supabase Realtime for stale admin data
4. Medusa Promotions wiring for loyalty redemption at checkout
5. Compliance anonymization + DSAR Medusa merge
6. Vercel Cron (or Inngest schedule) for payment finalize
7. Verify campaign execute + experiment storefront consumption
8. Upstash (or equivalent) for distributed rate limits

## Links

- [SPEC-VERDICT.md](./SPEC-VERDICT.md) — checklist 1–26 with Revision 2 notes per item
- [README.md](./README.md) — index of per-item ADR plans
