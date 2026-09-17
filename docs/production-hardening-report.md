# Production hardening report

Date: 2026-09-17  
Branch: `dev`  
Scope: `.omx/plans/dev-memory-hardening.md` and `.omx/plans/full-production-optimization-audit.md`

## Executive result

The confirmed local memory-retention defects were repaired and covered with focused tests. The live Vercel deployment was independently checked and is healthy. The repository is not release-ready from this checkout because the deployed Vercel source root (`apps/storefront`) does not match the current dirty migration tree (`apps/web` with deleted legacy trees). Production source mapping and production SQL/cost claims therefore remain explicitly blocked rather than inferred.

## Implemented findings

| Finding | Severity | Root cause | Fix | Verification |
|---|---:|---|---|---|
| Auth enrichment cache could grow for every distinct email | High | Module-global map expired entries only on lookup and had no capacity bound | Added TTL + lazy expiry pruning + LRU capacity eviction behind `createAuthEnrichmentCache` | `auth-cache.test.ts`, focused test run |
| Admin SSE clients could survive multiple close paths | High | Abort, cancel, and controller failure did not share an idempotent cleanup invariant | Added one cleanup path removing abort listeners, unregistering client, and safely closing/erroring stream | `admin-sse-hub.test.ts`, focused test run |
| Inventory stream abort race | High | Abort listener was not guaranteed to be installed before the first awaited fetch | Install listener before `send()`, propagate the request signal into the Worker fetch, gate enqueue/interval on closed state, clear interval on cancel | `route.test.ts`, focused test run |
| Remote rate-limit timeout handle retention | High | Timeout was not cleared on all fetch outcomes | Clear timeout in `finally` for success, HTTP failure, and thrown fetch failure | `admin-rate-limit.test.ts`, focused test run |
| Local rate-limit fallback could exceed its map cap | Medium | Expired entries were pruned, but live overflow was not evicted | Added deterministic oldest-entry eviction after expiry pruning | Included in rate-limit implementation and tests |
| CMS preview iframe document regeneration | High | Large generated `srcDoc` strings were recalculated on unrelated builder state changes | Memoized selected and variant preview documents by relevant definition/draft inputs and kept stable variant keys | `cms-page-builder-preview.test.ts`, focused test run |
| CMS/admin stale request updates | Medium | Unmount or filter changes could allow old requests to update state | Added AbortController propagation and abort-aware state finalization to prioritized managers | Web typecheck + targeted ESLint |
| Duplicate Supabase session read in storefront middleware | Medium | Account redirect path performed a second session lookup | Reused the first `getUser()` result | Web typecheck + targeted ESLint |
| Unbounded admin CMS list reads | Medium | Category, blog, and announcement GET handlers had no result limit | Added bounded `limit` query parameter with a maximum of 100 | Worker test/typecheck gate pending in verification section |
| Development memory attribution | High | Existing heap cap was applied but no process-tree/HMR evidence was captured | Added bounded `diagnose:dev-memory` wrapper with RSS process-tree samples, heap-data proxy, HMR/full-reload counters, duration cap, and safe shutdown | Node syntax check; bounded runtime probe still requires a controlled local stack |

## Cache and latency classification

Public Worker catalog/CMS/navigation/review responses already carry explicit short-lived public cache headers. Account, admin, checkout, payment, inventory-sensitive, error, and streaming surfaces remain dynamic/no-store. No broad cache was added without a measured key or freshness contract. Middleware duplicate auth work was removed; CMS redirect lookup remains short-lived and fail-open on dependency failure.

## Security and commerce review

The current route surface includes staff-session guards, permission checks, request IDs, body-size/content-type checks, idempotency enforcement, signed/internal webhook branches, and route-level validation. The hardening pass preserved those contracts. Critical payment/order state transitions were not rewritten without a representative integration environment; they require the existing sandbox and database-backed gates.

## SQL review

Static inspection found `SELECT *` in admin read/snapshot paths and offset pagination in bounded admin/catalog paths. The CMS page `SELECT * ... FOR UPDATE` is intentionally used to snapshot the complete prior row before a versioned update. Admin category/blog/announcement reads are now bounded to 100 rows. No index migration was invented: `EXPLAIN (ANALYZE, BUFFERS)` evidence requires a safe representative `MEDUSA_DB_URL`/`APP_DB_URL` environment and production traffic/cardinality mapping.

## RSC, TypeScript, and storefront review

The CMS preview change remains client-side because it owns iframe editing and postMessage interactions. No server-owned data boundary was moved without browser regression coverage. The web TypeScript program passed a one-shot no-emit check with a 1536 MB Node cap. Existing route/cache behavior was preserved where it protects SEO, prices, inventory, account state, checkout, and payment correctness.

## Deployment and observability findings

The live deployment was checked directly: `https://universalmusic.vercel.app/` returned 200 and `/api/health` returned 200 with `service: storefront` and `status: ok`, plus security/request headers. Vercel project metadata still points at historical `apps/storefront`, while this checkout contains `apps/web` and deleted legacy trees. The Vercel collector consequently reported `unknown` framework/source mapping. This is a release/source-of-truth blocker, not a production outage. Route-level p95, cache-hit, cost, and EXPLAIN claims remain unmade until the mapping is reconciled.

## Remaining blockers and risks

1. Reconcile the dirty migration through normal version-control workflow and establish one tracked source of truth; no reset or destructive cleanup was performed.
2. Confirm the deployed commit/root relationship before changing Vercel project settings or rerunning source-mapped optimization.
3. Run safe-database EXPLAIN plans for top traffic SQL before adding indexes or replacing offset pagination.
4. Run a controlled 15-minute dev probe and CMS repeated-edit reproduction; do not continue if host swap pressure or OOM indicators appear.
5. Run provider-backed security/commerce E2E gates with real sandbox credentials where required.

## Verification evidence

- Focused web tests: 15 passed, 0 failed after final stream-module integration.
- Full web test suite: 492 passed, 0 failed.
- Targeted web ESLint: passed.
- Web TypeScript no-emit: passed under `NODE_OPTIONS=--max-old-space-size=1536`.
- Diagnostic script syntax and package-script registration: passed.
- Live production checks: root 200; health 200.
- Static security/release checks: admin guard, 196-operation OpenAPI contract, client boundary, migration boundary, and audit triage all passed.
- Web production build: passed under `NODE_OPTIONS=--max-old-space-size=1536` (206 static pages generated).
- Bounded dev smoke probe: 60 seconds, 12 samples, peak aggregate process-tree RSS 1489.9 MiB, Next RSS stabilized around 350–427 MiB, no OOM/error/full-reload counters; the probe terminated the stack cleanly at the safety limit. A full 15-minute repeated-CMS-edit run remains intentionally deferred because it requires browser interaction and a longer host-pressure window.
- Full workspace build, provider E2E, production SQL EXPLAIN, and bounded 15-minute CMS probe: not yet run in this pass; see blockers above.

## Architect review

The architect review returned `REJECT` because the source tree remains untracked/migrating and provider-backed E2E/SQL/long-duration evidence is unavailable. One reported typecheck failure was stale relative to the final checkout: a fresh web typecheck passed after the review. The substantive lifecycle concern—propagating client abort into the inventory upstream fetch—was repaired afterward and covered by the stream tests.
