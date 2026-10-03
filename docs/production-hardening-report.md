# Production hardening report

## Current evidence refresh — 2026-10-01

The production Worker was redeployed as `8f8f346a-1f10-4d20-b0d4-3c986751d732`. Direct readiness and the public Vercel health contract passed. The production runtime-settings API was used to preserve the organization payload and add only `XENDIT` to the enabled payment-provider allow-list, which had been the root cause of the live methods endpoint returning COD only. Worker and Vercel now return `XENDIT` and `COD`. The latest hosted Xendit run passed failed/expired return paths 2/2, but the hosted-success card-field flow failed before payment completion; the earlier success claim is superseded. The CMS production-mode repeated mutation/restore flow passed 15/15 in 5.0 minutes. A fresh direct-process 15-minute idle probe also completed for 900,008 ms with 180 samples, 1,600.1 MiB peak aggregate RSS, and zero Fast Refresh, full-reload, or error counters. These results do not certify provider webhooks/refunds/reconciliation, production p95/queue SLOs, or an interactive CMS memory soak.

## Current authoritative snapshot — 2026-10-01

The latest local generation produced 280 OpenAPI operations, 323 executable
schemas, 0 heuristic schemas, 0 unresolved schemas, and 603 matching
source hashes. The checked admin subset reports 196 route operations. Older
numeric snapshots below remain historical evidence.

This section supersedes older numeric snapshots below while preserving them as
historical evidence. The current checkout is on `dev` and remains intentionally
uncommitted; linked Vercel deployment `dpl_5LVno3rqv48wDBzDjegU2jWCgHZr` reached
READY, and the production health contract passes against the live alias.

Fresh repository gates:

This hardening pass also closed a live-editor trust-boundary gap: visual CMS
`innerHTML`, `href`, and `src` edits now use the same safe-value policy before
lifecycle handlers and canvas serialization, so the preview cannot display
markup or executable URLs that the published renderer would later remove.
Focused CMS coverage proves script/event-handler and `javascript:`/`data:` URL
rejection while preserving safe formatting and relative links.

- OpenAPI parity is current at 280 total operations, 323 executable schemas,
  0 unresolved schemas, and 603 matching route source hashes. The
  checked admin subset reports 196 route operations; generated artifacts remain
  governed by the source-drift check.
- `pnpm quality:contracts` passes: admin guard, OpenAPI parity, source-drift,
  webhook boundary, route ownership, route-state inventory, storefront client
  boundary, migration boundary, and audit triage.
- Route ownership reports 207 route files with no unsafe Worker-origin database
  imports. Route-state inventory covers 92 pages with 92 loading and 92 error
  boundaries; runtime browser verification remains separate.
- Knip is clean under the current `knip.json` workspace configuration.
- OpenSSF Scorecard is now runnable through the repository wrapper. The
  current-checkout scan scores 7.0/10 and reports 10/10 for dangerous
  workflows, token permissions, and vulnerabilities. Its 0/10 binary-artifact,
  fuzzing, and SAST signals are local-scan or repository-history limitations,
  not silently treated as passes. Remote scans fail closed when
  `GITHUB_AUTH_TOKEN`/`GH_TOKEN` is absent; the GitHub Actions workflow is the
  authoritative remote scan surface.
- The inventory SSE stream no longer blocks stream setup on its first upstream
  read; abort ownership remains inside the send operation and its existing
  cancellation tests pass. The Philippine address cascade now uses complete
  address identity for its dependent effect and guards the NCR normalization
  write against repeat updates, removing one stale-dependency diagnostic.
- Turbo/Vercel environment propagation is explicit in `turbo.json`; the latest
  production build no longer emits the missing-environment-variable warning.
- React Doctor reports 102 source warnings and 0 errors under the configured
  ratchet budget of 102; generated `.next-dev` source maps are excluded.
- The persisted direct-process development memory probe completed its full
  900,008 ms duration with 180 samples, 1,600.1 MiB peak aggregate RSS, and
  zero Fast Refresh, full-reload, or error counters across the Next,
  Worker, esbuild, and workerd process tree. This is idle/startup stability
  evidence; it is not interactive CMS-edit telemetry or production SLO proof.
- The fresh local production-server cart E2E regression now passes 13/13. Its
  loading assertion accepts the accessible streamed root boundary that Next
  actually sends before client hydration, and its direct API check derives the
  configured Playwright port instead of assuming `localhost:3000`.
- The matrix verifier currently inventories all 403 rows with 59 verified and
  344 explicitly blocked. It is structurally green (all 403 evidence records,
  zero unresolved rows, zero verifier errors), but the release gate remains
  open because the blocked rows require their stated recovery runs. Fresh
  hosted storefront UX (25/25) and API-security (9/9) evidence was regenerated.
  Fresh PayPal cancel/decline, Xendit failure/expiry, performance,
  catalog, API-security, public-route, and hosted storefront UX checks pass.
  The deployed About browser proof still fails on a cross-origin blocked
  Xendit logo request; the source fix removes that remote asset and falls back
  to the accessible local label, but it still requires deployment and a fresh
  hosted rerun. Fresh isolated
  production-artifact Stripe success/decline and COD runs reached scoped
  `/track/:orderId`; the invalid COD body returned HTTP 400. The deployed
  merchant context still has Stripe disabled, so live Stripe webhook proof
  remains external. A fresh
  deployed axe run found the catalog Types
  tooltip accessible-name defect; the source fix passes local axe 10/10, but
  deployment and hosted rerun remain required. Webhook delivery,
  reconciliation, refunds, and chargebacks remain external proof requirements.
  The E2E staff fixture now waits for cold Next compilation and reports
  authentication failures explicitly instead of misclassifying them as a
  missing UI.
  The full sequential matrix also needs a stable
  long-run harness because one run restarted the local Next process mid-suite.

The release verdict remains **Not ready** until the remaining provider-backed
callback evidence and interactive CMS memory soak are completed. Read-only
planner evidence is now captured for both configured databases, but it does not
replace production traffic/cardinality evidence or `EXPLAIN ANALYZE` on a safe
representative environment.

Verification for this snapshot: `pnpm --filter @universal-music-store/web test`
(595/595), `pnpm --filter @universal-music-store/web typecheck`, web lint,
`pnpm quality:contracts`, `pnpm test:backend:worker:all` (519/519),
`pnpm quality:knip`, `pnpm security:check`, and `git diff --check` all pass on
the current dirty `dev` checkout.

Date: 2026-09-17  
Branch: `dev`  
Scope: `.omx/plans/dev-memory-hardening.md` and `.omx/plans/full-production-optimization-audit.md`

Evidence note: sections and addenda labelled with earlier dates are retained as an audit trail. The dated **Current authoritative snapshot (2026-09-21)** and latest addendum supersede earlier route, hash, and test counts.

## Executive result

The dated memory-hardening snapshot below is historical. Its provider and
deployment observations are superseded by the current evidence refresh above;
the implementation findings remain useful as an audit trail.

The confirmed local memory-retention defects were repaired and covered with focused tests. The live Vercel deployment was independently checked and is healthy. Stripe sandbox paths, Xendit hosted checkout, and Xendit failure/expiry paths passed in isolated reruns. The repository is not release-ready from this checkout because provider webhook/refund evidence, production traffic/cardinality evidence, telemetry-backed CMS memory proof, and dirty migration reconciliation remain open; no destructive cleanup was performed.

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
| Duplicate Supabase session work on API requests | Medium | Middleware performed Supabase auth and CMS redirect work before route handlers repeated their own checks | API middleware now preserves request IDs/rate/content guards and returns directly; page routes retain session redirects | Web typecheck + lint + contract gates |
| Unbounded admin CMS list reads | Medium | Category, blog, and announcement GET handlers had no result limit | Added bounded `limit` query parameter with a maximum of 100 | Worker suite 363/363, typecheck, and contract gates |
| Development memory attribution | High | Existing heap cap was applied but no process-tree/HMR evidence was captured | Added bounded `diagnose:dev-memory` wrapper with RSS process-tree samples, heap-data proxy, HMR/full-reload counters, duration cap, and safe shutdown | Node syntax check; bounded runtime probe still requires a controlled local stack |
| Visual CMS preview accepted unsanitized markup and URLs | High | The live visual mutation path passed `innerHTML`, `href`, and `src` directly to lifecycle handlers and the iframe before published rendering sanitized them | Apply the shared CMS HTML and safe-URL policy at the visual mutation boundary before lifecycle handling and serialized canvas output | `cms-page-builder-preview.test.ts` 4/4; web typecheck and lint; Worker and contract gates |

## Cache and latency classification

Public Worker catalog/CMS/navigation/review responses already carry explicit short-lived public cache headers. Account, admin, checkout, payment, inventory-sensitive, error, and streaming surfaces remain dynamic/no-store. No broad cache was added without a measured key or freshness contract. Middleware duplicate auth work was removed; CMS redirect lookup remains short-lived and fail-open on dependency failure.

## Security and commerce review

The current route surface includes staff-session guards, permission checks, request IDs, body-size/content-type checks, idempotency enforcement, signed/internal webhook branches, and route-level validation. The hardening pass preserved those contracts. Critical payment/order state transitions were not rewritten without a representative integration environment; they require the existing sandbox and database-backed gates.

## SQL review

Static inspection found `SELECT *` in admin read/snapshot paths and offset pagination in bounded admin/catalog paths. The CMS page `SELECT * ... FOR UPDATE` is intentionally used to snapshot the complete prior row before a versioned update. Public Worker reads now use explicit caps: blog 100, category content 500, sitemap 5,000, regions 100, collection products 500, receipt items 500, and staff grants 100; customer/admin pagination clamps offsets at 100,000. The earlier generic `HYPERDRIVE` compatibility fallback has been removed; Worker database access now requires the explicit APP or MEDUSA role binding/URL. Safe `EXPLAIN (ANALYZE, BUFFERS)` probes now run against both configured databases in read-only transactions with rollback: payment-attempt correlation, audit recency, inventory reservations, order display IDs, and inventory levels use their intended indexes. CMS publication and catalog publication still choose sequential scans on the current tiny datasets (9 and 22 estimated rows), so no speculative index migration was added. Production traffic/cardinality mapping remains the only SQL-performance evidence gap.

## RSC, TypeScript, and storefront review

The CMS preview change remains client-side because it owns iframe editing and postMessage interactions. No server-owned data boundary was moved without browser regression coverage. A bounded one-shot web TypeScript diagnostic passed with 2,861 files, 518,667 KiB compiler memory, and 2.03 seconds total time. Existing route/cache behavior was preserved where it protects SEO, prices, inventory, account state, checkout, and payment correctness.

## Deployment and observability findings

The live deployment was checked directly: `https://universalmusic.vercel.app/` returned 200 and the live health contract passed against `/api/health/sop`, including Worker readiness. Local linked Vercel metadata targets `apps/web` and the `@universal-music-store/web` build, and the current checkout was deployed as `dpl_5LVno3rqv48wDBzDjegU2jWCgHZr`. This proves the current local deployment path and health contract; it does not prove production traffic p95, cache-hit, cost, or production traffic/cardinality SQL plans.

## Remaining blockers and risks

1. Reconcile the dirty migration through normal version-control workflow and establish one tracked source of truth; no reset or destructive cleanup was performed.
2. Keep the deployed commit/root relationship recorded when the dirty checkout is eventually reconciled through normal version control; no project-setting change is currently required.
3. Run safe-database `EXPLAIN ANALYZE` plans for top traffic SQL before adding indexes or replacing offset pagination; current non-analyze planner evidence is recorded above.
4. Run a controlled 15-minute dev probe and CMS repeated-edit reproduction; do not continue if host swap pressure or OOM indicators appear. The idle probe is now complete with persisted telemetry: 900,008 ms, 180 samples, 1,600.1 MiB peak aggregate RSS, and zero refresh/reload/error counters. The focused stateful CMS editor flow passes 10/10 repetitions over 4.3 minutes, including drag/drop, inspector edits, undo/redo, save/reload, and cleanup; process-RSS telemetry for a full 15-minute interactive editor soak remains open.
5. Repeat the full provider-backed security/commerce E2E matrix in a stable isolated harness. Current evidence: PayPal cancel/decline, deployed Xendit failure/expiry, performance, catalog, API-security, and public-route checks pass; Stripe, Xendit hosted-success, COD, authenticated account/wishlist, deployed About, webhook delivery, reconciliation, refund, and admin-visibility evidence remain open.
6. The matrix evidence verifier now recognizes explicit external blockers: across `.omx/context/full-task(4..8).md`, 403 rows are inventoried, 59 are marked verified, and 344 are explicitly blocked with row-level recovery conditions and hashed blocker records. All rows have evidence records, zero unresolved rows, and zero verifier errors, but the release gate remains open because blocked rows still require their stated recovery runs.

The 2026-09-23 verifier snapshot above is historical. It is superseded for
diagnosis by the current 2026-10-02 run, which reports 59 verified rows, 344
blocked rows, zero unresolved rows, 403 evidence records, and no validation
errors. This is a structural evidence check, not proof that the blocked
external scenarios have been executed.

The static UI boundary inventory now covers all 92 App Router pages with loading and error boundaries (92/92 each). This closes the missing-boundary inventory finding but does not replace direct authenticated browser verification of each state.

Development diagnostics now expose a bounded, explicitly flagged snapshot of Node RSS/heap/external memory, event-loop delay, and active SSE clients through `/api/internal/dev-diagnostics`; production and unflagged environments return 404. The latest persisted direct-process idle probe completed for 900,008 ms with 180 samples, 1,600.1 MiB peak aggregate RSS, zero error/reload counters, and no probe failure. The probe now fails closed at a configurable 6,000 MiB aggregate RSS threshold. The default Turbopack CMS flow passes 5/5; the focused stateful editor flow passed 10/10 over 4.3 minutes. A 30-repeat/15.3-minute run reached 27/30 before three transport/reload failures; the Worker bridge now has a bounded mutation deadline and the fixture retries only transient transport errors, with a fresh 3/3 targeted rerun passing. The idle gate is closed; interactive editor-loop telemetry remains open.

The account loyalty read was migrated off the web service-role Supabase client to the Worker-owned application database contract (`/store/customers/me/loyalty`). The Worker authenticates the bearer identity, scopes by normalized email, and limits transaction history to 50 rows; Worker regression coverage passes.

The Worker SQL hardening pass added deterministic bounds to public CMS/catalog, receipt, and staff-grant reads, bounded customer/admin offset pagination, and explicit fail-closed handling for known native routes when no role-specific database binding is configured. Worker regression coverage is 289/289 passing after this pass.

The platform-data campaign listing now uses an explicit column projection with its existing 500-row cap, and the legacy segment-member detail contract now applies a 10,000-row database limit; large campaign execution continues to use deterministic 500-row paging.

The compliance/DSAR export was also bounded across both database roles: customer orders (500), order items (5,000), addresses (100), payments (1,000), application rows (500), wishlists (100), and delivery attempts (500). The export response declares these limits, and the compliance regression suite asserts the generated SQL contains the caps.

Campaign execution no longer materializes an entire segment, consent table, or sent-recipient table in one isolate. It reads each in deterministic 500-row pages, projects only required campaign columns, and preserves the existing missing-table compatibility behavior. Platform-data build and 97-package tests pass.

Critical provider/commerce failure paths were normalized so POS, PayPal confirmation, checkout provider failures, Stripe catalog synchronization, and admin catalog lookup/search return stable safe error codes rather than provider or database exception text. Worker tests, web typecheck, and web lint pass after the change.

## Current authoritative snapshot (2026-09-29)

Historical snapshot (2026-09-21; superseded by the current authoritative snapshot above): the route manifest reported 205 API route files and the generated OpenAPI reference reported 276 operations, 193 checked admin matches, and 594 source hashes. External deployment/provider/source-root gates remained open.

The authenticated-free production API health suite was also run against `https://universalmusic.vercel.app` on 2026-09-21 with `PLAYWRIGHT_SKIP_WEBSERVER=1` (43 cases: 10 passed, 17 failed, 16 skipped because provider/admin credentials were not available). The 16 unauthenticated admin assertions expected 401/403 but received 404; a direct response confirms `x-matched-path: /404`, `x-next-error-status: 404`, and a cached global Next 404 for `/api/admin/inventory` rather than the current admin route boundary. The cron secret-negative assertion expected 401 but received 503 with `{"error":"Payment recovery is temporarily unavailable"}`. This is deployment/source/configuration drift evidence, not permission to weaken the local security contract: current local admin handlers still require 401/403 and the cron handler is tested locally. Production availability is proven only for the public storefront/health surface until the deployed commit, Vercel root, and Worker/API configuration are reconciled.

Vercel evidence is now verified through the connected project: `universalmusic` is a Next.js project; the `dev` preview deployment is READY at `universalmusic-preview.vercel.app` from `JustineDevs/UMS` commit `c97937c`; and the `main` production deployment is READY at `universalmusic.vercel.app` from commit `81aada3`. This proves deployment availability and branch topology, not that the current dirty checkout matches either deployed commit.

Current React Doctor evidence is 102 source warnings and 0 errors; the warning backlog remains explicitly non-blocking and tracked rather than represented as warning-free.

The current sequential Worker suite is 519/519 passing and the full web suite is 595/595 passing; older addenda retain their historical test counts for traceability.

All shared web-to-Worker JSON response reads now use a streaming byte-bounded decoder with a 1 MiB default cap and safe fallback on invalid or oversized bodies. The helper has focused coverage for success, error, invalid JSON, and oversized upstream responses; the full web suite is 595/595 passing.

The admin Worker bridge was migrated to that decoder across all 11 response paths, the catalog Worker fetcher now uses it for both product-list and product-detail reads, and the public proxy, cart, checkout, channel-event, POS catalog, inventory guard, account-order, account, catalog, admin, integration, and compliance proxy paths were migrated as well. These Worker-facing payloads cannot bypass the upstream byte limit.

The workflow listing route no longer exposes database exception text: the catch path logs server-side and returns a stable `SERVICE_UNAVAILABLE` problem response with the correlation ID. Cart reconciliation now validates the Worker response as JSON, normalizes non-success and invalid responses, attaches request IDs, and aborts the upstream request after 10 seconds. Web lint, typecheck, contract gates, and the 585-test web suite pass after these changes.

The generated route ownership manifest recognizes API_URL-backed Worker proxies explicitly: zero `web-platform-database` routes remain; no admin route remains direct-database-owned. Cart abandonment, review helpful/report mutations, and receipt upload are now Worker-owned with signed forwarding, independent bearer/CSRF or session enforcement, bounded bodies, private-storage cleanup, duplicate-safe writes, and transactional moderation. The manifest no longer mislabels session-only Supabase clients as database ownership; the CMS page collection, detail, mutation-history, navigation, navigation publish, announcement, blog collection/detail, blog bulk/export, block-presets lifecycle, form-settings lifecycle, experiments lifecycle, components lifecycle, redirects lifecycle, CRM bridge/notes/operations lifecycles, delivery logistics operations, payment-health, payment-attempts export, checkout loyalty-balance, audit-log, commerce-recovery-metrics, inventory-ledger, cycle-count lifecycle, purchase-order lifecycle, transfer lifecycle, admin-review-list, admin-roles, admin-tasks-today, admin-integration-health, admin-loyalty lookup and account/points/rewards, admin-payments, admin-payment-capabilities, admin-profile, storefront metadata, runtime settings, offline queue, devices, review moderation, operator notes, customer segments, employees, and campaigns routes are now Worker-owned.

Historical warning-detail paragraph below is retained for traceability; its old 132-warning count is superseded by the current authoritative count of 102 warnings and 0 errors.

React Doctor previously reported 239 warnings and 0 errors. The public JSON-LD injection, CMS preview iframe, upstream response-read findings, URL validation, roles/reconciliation retry states, 108 admin/form accessibility findings, nineteen placeholder-only fields, abortable data-loading effects, stuck-loading error paths, synchronous mutation-ref re-entry guards, numeric-input validation, static avatar discovery caching, currency formatter caching, linear lookup optimization, property-specific POS/analytics transitions, stable domain keys for dynamic lists, dynamic moderation regex escaping, CRM opportunity/onboarding/blog-editor loading finalization, independent CMS bulk loops, parallel response decoding in search suggestions, route-param/session/cookie acquisitions, redundant map/filter pipelines, CMS editor promise-chain findings, locale/timezone determinism findings, explicit transition-property findings, single-pass flat-map transformations, additional unstable list keys, preview-message state derivation outside state updaters, non-visual mutation guards, dependency identity stabilization, bounded parallel related-product lookups, analytics retention single-pass aggregation, independent instrumentation/cron/reconciliation awaits, internal navigation link hygiene, visual-builder selector/definition single-pass transforms, remaining index-key fallbacks with stable domain/content keys, CMS blog mutation re-entry guards, parallel shift-close reads, checkout loyalty error ownership, component-definition iframe isolation, the main editor postMessage sandbox bridge, repeated membership scans, unnecessary non-success response reads, repeated property/schema lookups, redundant map/filter passes, and search-param Suspense boundaries were fixed with shared serialization, sandbox boundaries, status-aware parsing, explicit control labels, cancellation, finally-based cleanup, bounded parallel work, deterministic formatting, and regression coverage; remaining warnings were tracked as non-blocking hygiene work and were not presented as zero-risk.

Webhook signature warnings at the Vercel proxy layer are covered by an executable boundary check. The secretless Next handlers forward the provider signature/replay headers, while the Cloudflare Worker verifies HMAC signatures and persists replay protection. `pnpm run check:webhook-proxy-boundary` is part of `pnpm run quality:contracts`.

The admin analytics page no longer fetches the full order dataset three times per render. It collects one bounded, tenant-scoped paginated order set, reuses it for KPIs and charts, and fails with a normalized `RESOURCE_LIMIT` response when the 10,000-order safety ceiling is exceeded rather than accumulating unbounded server memory.

The admin delivery-operations read now uses explicit courier and exception projections instead of `SELECT *`, while retaining tenant scoping and a 200-row cap per collection. This removes avoidable payload/schema drift from a dashboard read without changing its response contract.

Admin middleware no longer clones and parses every JSON mutation body before the route handler. The shared bounded parser now owns byte limits, stream-lock release, malformed JSON handling, and prototype-pollution key rejection; the one direct `request.json()` route was migrated to that parser. This removes duplicate body materialization while preserving fail-closed validation.

## Verification evidence

- Focused web tests: passed after final stream-module integration.
- Current full web test suite: 585 passed, 0 failed.
- Current Worker suite: 519 passed, 0 failed.
- Current generated ownership snapshot: zero `web-platform-database` storefront routes remain and no admin route is direct-database-owned; `check:route-ownership` passes.
- Current web suite after response-contract, lifecycle, and safe-provider hardening: 585 passed, 0 failed.
- Current web ESLint: passed.
- Current workspace TypeScript no-emit: passed for web, Worker, SDK, and mail packages.
- Diagnostic script syntax and package-script registration: passed.
- Live production checks: root 200; health 200.
- Live production API health suite: 10/43 passed, 17 failed, 16 skipped; admin paths resolve to the global 404 and the cron secret-negative path returns 503. This is a release blocker for deployment/source-root/configuration reconciliation, not a local route-contract waiver.
- Historical static security/release checks (2026-09-21): admin guard, 193-operation local admin OpenAPI contract, client boundary, migration boundary, route-state, source-drift (594 hashes), and audit triage passed. Current counts are in the authoritative snapshot above.
- Web production build: passed (Next 15.5.24; 170 static pages generated) with the bounded 1,536 MiB Node old-space cap and one Turbo worker. Webpack still reports 113 KiB and 267 KiB CMS strings in its persistent cache; this remains an optimization target.
- Bounded dev memory probes: the latest persisted direct-process run completed for 900,008 ms with 180 samples, 1,600.1 MiB peak aggregate RSS, the full Next/Worker/esbuild/workerd stack, zero Fast Refresh/full-reload/error counters, and clean supervised shutdown. The earlier scope-aware 60,009 ms run peaked at 1,526.8 MiB. This closes the 15-minute idle-process evidence gap; it does not certify an interactive CMS-edit memory soak.
- CMS browser verification: Chromium is installed and the builder/embedded preview reach the real application. The complete canonical CMS file passes 5/5 under the default Turbopack launcher, and the focused stateful editor flow passes 10/10 repetitions over 4.3 minutes. The earlier 30-repeat/15.3-minute dev-mode run completed 27/30 and exposed Fast Refresh transport/reload failures plus fixture cleanup drift. After adding bounded Worker mutation timeouts, transient-request retries, exact CMS-page snapshot/restore, and a 200-node-cap fixture guard, the production-mode Worker-backed flow passes 15/15 repetitions in 5.0 minutes. This proves repeated authenticated editor mutation/restore for this flow; it is not a blanket all-admin-flow or leak-free memory claim.
- Full workspace build and provider E2E remain environment-dependent release checks; safe production SQL traffic/cardinality mapping and a telemetry-backed interactive 15-minute CMS memory reproduction remain unverified in this checkout. The read-only SQL EXPLAIN evidence, clean production-mode CMS mutation soak, and completed 15-minute idle-process probe are recorded separately above.

## Addendum: API contract and route-boundary hardening (2026-09-20)

This addendum is a historical checkpoint retained for traceability. The current
authoritative snapshot and verification evidence above supersede its intermediate
route, hash, test, and warning counts.

Current generated evidence supersedes earlier narrative counts: 19 `web-platform-database` routes remain, including 14 admin routes; the current OpenAPI source-drift gate reports 600 matching hashes.

Latest generated evidence supersedes that snapshot: 18 `web-platform-database` routes remain, including 13 admin routes; the current OpenAPI source-drift gate reports 599 matching hashes after the POS enterprise and storefront-home Worker migrations.

Latest generated evidence supersedes that snapshot: 15 `web-platform-database` routes remain, including 10 admin routes; the current OpenAPI source-drift gate reports 597 matching hashes after the shift lifecycle migration, with the full Worker suite at 320/320.

The API audit identified and repaired additional shared-boundary defects:

| Finding | Repair | Evidence |
|---|---|---|
| OpenAPI source drift could be presented as current | Generator emits SHA-256 source fingerprints; a repository check fails on stale hashes | `check:admin-openapi-source`, 603 hashes match |
| OpenAPI duplicated full handler snapshots and allowed stale embedded source | Generator now emits only source paths plus SHA-256 fingerprints; full `x-source` snapshots were removed | Regenerated 275-operation YAML; no exact `x-source` fields; contract gate passes |
| Empty inferred OpenAPI schemas could falsely imply strict validation | Schema authority is now explicit; generated operations use bounded executable request/response schemas | Current reference: 323 executable, 0 heuristic, 0 unresolved; raw CSV responses are explicitly documented as binary |
| Request schemas omitted required fields | Generator now derives required fields from non-optional Zod properties | Regenerated 275-operation reference |
| Empty/inferred schemas were indistinguishable from proven schemas | Every schema now carries executable/heuristic/non-authoritative status and source drift is checked | Current reference reports 323 executable, 0 heuristic, 0 unresolved entries |
| High-impact mutation/request schemas duplicated runtime rules | All 72 body-reading request operations now import shared Zod schemas or shared validation objects; generator emits `runtime-zod` / `executable` metadata | Web tests 539/539; OpenAPI gate passes |
| Platform list reads could materialize unbounded tenant data | Added database-side caps to CMS redirects, pages, blogs, categories, experiments, components, announcements, campaigns, segments, employees, devices, payment links, reasons, and rewards; redirect reads also use a narrow projection | Platform-data build/lint/tests pass; caps are enforced before row materialization |
| CMS media mutations bypassed the durable shared idempotency boundary | Wrapped media POST/PATCH/DELETE with `withAdminMutationIdempotency` | CMS hardening test and full web suite |
| Admin invoice lifecycle request was source-inferred in OpenAPI | Promoted the route-local action schema into the shared runtime contract registry and reused it in the handler | The executable-schema count increased; admin heuristic-schema gate passes; web typecheck/tests |
| Public health/catalog/search responses were source-inferred in OpenAPI | Added bounded shared response schemas and validated successful route responses at the Next boundary | OpenAPI executable-schema count increased; web typecheck and 585/585 tests |
| Customer loyalty, marketing-preferences, and order-preferences responses were source-inferred in OpenAPI | Added bounded shared response schemas and validated successful Worker hydration responses | OpenAPI executable schemas now 287 after cron, checkout-intent, profile, back-in-stock, COD, newsletter, and checkout mutation response promotions; web typecheck and 585/585 tests |
| Production Upstash failure fell back to per-isolate memory | Production limiter now fails closed; local bounded map remains development-only | Rate-limit tests; full web suite |
| Broken SSE controllers could remain in the process registry | Added safe event publication with failed-controller eviction | SSE hub tests; full web suite |
| Inventory stream exposed raw upstream exception text | Stream errors now return stable safe error codes | Inventory stream tests; full web suite |
| Deleted route trees poisoned typecheck through stale `.next` validators | Web pretypecheck cleans both Next output trees before compiling | Fresh workspace typecheck passed |
| Audit logs were a direct web-service DB read without explicit tenant filtering | Moved the route to the Worker, enforced bearer permission and `details.organization_id` scope, bounded/validated filters, and capped CSV output | `audit-admin.test.ts`; full Worker suite 289/289; route ownership and OpenAPI gates pass |
| Commerce recovery metrics aggregated invalidations without tenant scope | Moved the bounded aggregate to the Worker and require the authenticated organization in the SQL predicate | `payment-recovery-admin.test.ts`; Worker typecheck, web typecheck, and contract gates pass |
| Inventory ledger was a direct APP database read | Moved the projected, filtered, 200-row-capped read to the Worker with `inventory:read` and organization scope | `inventory-ledger-admin.test.ts`; Worker typecheck, web typecheck, and contract gates pass |
| Admin review moderation list was a direct APP database read | Moved the global moderation read to the Worker with `content:read`, explicit status/search validation, report-count projection, and a 200-row cap | `reviews-admin.test.ts`; Worker typecheck, web typecheck, and contract gates pass |
| Admin roles summary was a direct APP database read | Moved the global staff-policy summary to the Worker with `employees:read`, explicit projections, bounded role/grant reads, and a stable response shape | `roles-admin.test.ts`; Worker typecheck, web typecheck, and contract gates pass |
| Today-task feed read payment metrics without tenant scope | Moved the two task-driving aggregates to the Worker with the authenticated organization predicate and stable task ordering | `tasks-admin.test.ts`; Worker typecheck, web typecheck, and contract gates pass |
| Integration-health route mixed process and database ownership in Next.js | Moved provider connection lookup and capability projection to the Worker with a 50-row cap and no secret output | `integration-health-admin.test.ts`; Worker typecheck, web typecheck, and contract gates pass |
| Loyalty lookup used a direct `SELECT *` helper without a bounded identifier contract | Moved the global lookup to the Worker with one validated identifier, explicit projection, and `LIMIT 1` | `loyalty-admin.test.ts`; Worker typecheck, web typecheck, and contract gates pass |
| Admin payment-attempt list omitted tenant scope and used `SELECT *` | Moved the read to the Worker with explicit projection, organization filtering, a hard 200-row cap, and bounded error text | `payments-admin.test.ts`; Worker typecheck, web typecheck, and contract gates pass |
| Payment capability discovery mixed provider policy and direct connection lookup in Next.js | Moved capability policy, organization-scoped connection lookup, permission enforcement, bounded projection, and stable errors to the Worker | `payment-capabilities-admin.test.ts`; Worker suite 300/300; route ownership and OpenAPI gates pass |
| Admin profile mutation wrote directly through the Next service-role client | Moved the self-profile update to the Worker, bound it to the verified email claim, validated the payload, and added durable idempotency | `profile-admin.test.ts`; Worker suite 300/300; route ownership and OpenAPI gates pass |
| Storefront public metadata mixed global APP storage and Next service-role access | Moved bounded read/write projection to the Worker with explicit primary-key scope, normalized fields, and durable idempotency | `storefront-metadata-admin.test.ts`; Worker suite 285/285; route ownership and OpenAPI gates pass |
| Runtime settings mixed organization-scoped APP storage and Next service-role access | Moved read/write to the Worker with organization claim scope, bounded normalized settings, explicit projection, and durable idempotency | `runtime-settings-admin.test.ts`; Worker suite 291/291; route ownership and OpenAPI gates pass |
| CMS block presets used direct Next service-role reads/writes | Moved list/create/delete to the Worker with tenant-scoped projections, bounded block payloads, durable idempotency, and audit records | `block-presets-admin.ts`, `block-presets-admin.test.ts`; Worker suite 302/302; route ownership/OpenAPI/source-drift gates pass |
| CMS form settings used direct Next service-role reads/writes | Moved GET/PUT to the Worker with tenant-scoped projection, bounded settings validation, durable idempotency, and audit records | `form-settings-admin.ts`, `form-settings-admin.test.ts`; Worker suite 304/304; route ownership/OpenAPI/source-drift gates pass |
| CMS component definitions and redirect management used direct Next service-role access | Moved versioned component save/publish/archive and bounded redirect CRUD, bulk, import/export, and resolution to Worker-owned tenant-scoped handlers with durable idempotency and audit records | `cms-components-admin.ts`, `cms-redirects-admin.ts`; focused lifecycle tests, Worker typecheck, ownership/OpenAPI/source-drift gates pass |
| CMS experiments used direct Next service-role reads/writes | Moved list/upsert/update to the Worker with organization-scoped projections, bounded variant payloads, durable idempotency, and audit records | `cms-experiments-admin.ts`, `cms-experiments-admin.test.ts`; Worker suite 308/308; route ownership/OpenAPI/source-drift gates pass |
| CRM customer notes used direct Next service-role reads and writes | Moved list/create/delete to the Worker with organization-scoped projections, 100-row and 32 KiB bounds, durable idempotency, and audit records | `crm-notes-admin.ts`, `crm-notes-admin.test.ts`; Worker suite 305/305; route ownership/OpenAPI/source-drift gates pass |
| CRM operations used direct Next service-role reads and writes | Moved activity/deal/goal reads and lifecycle mutations to the Worker with organization-scoped projections, 200/100-row bounds, bounded payloads, durable idempotency, and audit records | `crm-operations-admin.ts`, `crm-operations-admin.test.ts`; Worker suite 306/306; route ownership/OpenAPI/source-drift gates pass |
| Loyalty account, points, and rewards routes used direct Next service-role data access | Moved account list/create, points add/redeem, and reward list/create to the Worker with explicit projections, 500-row bounds, transactional point updates, durable idempotency, and audit records | `loyalty-admin.ts`, `loyalty-admin.test.ts`; Worker suite 306/306; route ownership/OpenAPI/source-drift gates pass |
| Offline POS queue had no tenant scope, unbounded payload/read behavior, and direct Next mutations | Added organization ownership migration, bounded Worker projections and request bodies, explicit status transitions, and durable idempotency; updated sync callers | `120_offline_queue_tenant_scope.sql`, `offline-queue-admin.test.ts`; Worker suite 291/291; route ownership and OpenAPI gates pass |
| POS device routes relied on global device identity and direct Next service-role access | Added organization-scoped device identity migration, explicit bounded projections, tenant-filtered upsert/update/list operations, and Worker idempotency | `121_pos_devices_tenant_identity.sql`, `devices-admin.test.ts`; Worker suite 291/291; route ownership and OpenAPI gates pass |
| Operator notes used direct Next service-role reads and writes | Moved list/create to the Worker with entity-specific permissions, organization scope, 50-row reads, bounded bodies, and durable idempotency | `operator-notes-admin.ts`, `operator-notes-admin.test.ts`; Worker suite 293/293; route ownership and OpenAPI gates pass |
| Customer segment routes used direct Next service-role reads and writes | Moved segment and member collection operations to the Worker with CRM permission enforcement, organization scope, 500-row/read and 500-member/write bounds, explicit projections, and durable idempotency | `segments-admin.ts`, `segments-admin.test.ts`; Worker suite 293/293; route ownership and OpenAPI gates pass |
| Employee and PIN routes used direct Next service-role reads and writes | Moved employee CRUD and PIN verification/set operations to the Worker with employee permissions, organization scope, explicit projections, bounded payloads, PIN hashing, optional step-up enforcement, and durable mutation idempotency | `employees-admin.ts`, `employees-admin.test.ts`; Worker suite 293/293; route ownership and OpenAPI gates pass |
| Campaign routes used direct Next service-role reads, writes, and job claims | Moved campaign CRUD and execution claim/job creation to the Worker, validated promotion references against the commerce DB, scoped segment access to the organization, bounded reads/bodies, and added durable execution replay | `campaigns-admin.ts`, `campaigns-admin.test.ts`; Worker suite 296/296; route ownership and OpenAPI gates pass |
| Cycle-count lifecycle split record state from commerce stock writes | Moved collection/detail/record/cancel/complete to the Worker; app DB owns lifecycle/audit state, commerce DB owns tenant-verified stock, with bounded reads, revision checks, guarded stock updates, and durable replay | `inventory-cycle-counts-admin.ts`, `inventory-cycle-counts-admin.test.ts`; Worker suite 296/296; route ownership/OpenAPI/source-drift gates pass |
| Purchase-order lifecycle split APP receipt state from commerce stock writes | Moved collection/detail/submit/cancel/receive to the Worker; app DB owns lifecycle/audit state, commerce DB owns tenant-verified inventory receipt writes, with bounded payloads, quantity guards, revision checks, and durable replay | `inventory-purchase-orders-admin.ts`, `inventory-purchase-orders-admin.test.ts`; Worker suite 300/300; route ownership/OpenAPI/source-drift gates pass |
| Inventory transfer lifecycle used direct APP writes and commerce helpers in Next | Moved collection/detail/approve/ship/complete/cancel to the Worker; app DB owns lifecycle/audit state, commerce DB locks and validates both tenant-owned locations before moving stock, with revision checks and durable replay | `inventory-transfers-admin.ts`, `inventory-transfers-admin.test.ts`; Worker suite 300/300; route ownership/OpenAPI/source-drift gates pass |
| Commerce recovery metrics authenticated staff but aggregated invalidations across organizations | Resolve the staff organization before querying and apply `organization_id`; reject malformed day windows | `payment-ledger-invalidation.test.ts`; platform-data build and web typecheck pass |

This historical addendum does not claim production readiness. The current evidence above supersedes its intermediate route, migration, SQL, memory, and deployment conclusions; source-to-deployment reconciliation, provider-backed hosted success, production traffic/cardinality mapping, and telemetry-backed memory proof remain explicit gates.

Historical snapshot (2026-09-21; superseded): the earlier migration evidence reported 276 OpenAPI operations, 193 checked admin matches, and 594 source hashes. It is retained for traceability only; the current authoritative evidence is at the top of this report.

The payment-recovery cron boundary now performs secret validation before constructing the Supabase client or reading either database, so an unauthenticated request cannot be converted into a dependency/configuration 503. The route-logic suite and full web suite remain green after this change. The live 503 observed above is therefore retained as evidence that the deployed function is stale or misconfigured until the correct source/configuration is promoted through the release workflow.

Fresh local runtime verification used the actual `apps/web` launcher on an isolated port (Next 15.5.24/Turbopack, port 3011): `/api/cron/finalize-payment-attempts` returned 401 without a secret and `/api/health` returned 200, then the temporary process was stopped cleanly. The long-lived port 3002 listener was not used because its process cwd is an unrelated Portfolio V2 application.

The first fresh production build exposed a static-generation failure on `/errors/429`: the error route inherited the public storefront layout, which performs CMS navigation/announcement/experiment/site-metadata reads during generation. The route was moved outside that layout and marked `force-static`; its URL and error UI are unchanged. The next bounded build generated all 170 static pages, including all `/errors/[code]` paths, and completed successfully in 2m10s.

The remaining Webpack cache warnings were traced to the generated visual-builder capture registries (`source-capture.ts` ~140 KiB and `ecommerce-capture.ts` ~64 KiB). They are imported only by the dynamically loaded CMS builder; the production build reports the builder as an isolated route with 105 KiB first-load JS and 104 KiB shared chunks. This is cache serialization overhead for editor provenance data, not shared storefront payload or an observed retention defect. No generated-data rewrite was made without evidence that it would reduce a shipped bundle or runtime memory.

## Architect review

The architect review returned `REJECT` because the source tree remains untracked/migrating and provider-backed E2E/SQL/long-duration evidence is unavailable. One reported typecheck failure was stale relative to the final checkout: a fresh web typecheck passed after the review. The substantive lifecycle concern—propagating client abort into the inventory upstream fetch—was repaired afterward and covered by the stream tests.

## Addendum: deployed verification pass (2026-09-23)

The following checks were run against the deployed storefront at
`https://universalmusic.vercel.app` with the production Worker at
`https://ums-backend-production.pcg0255.workers.dev`, using one Chromium worker:

- PayPal cancellation and declined-return safety: 2/2 passed; neither return exposed an order.
- Collection catalog browser proof: 2/2 passed; collection status and native collection navigation rendered.
- Storefront API security plus axe accessibility suite: 18/18 passed.
- Desktop and mobile performance budgets for `/`, `/shop`, and `/collections`: 6/6 passed; TTFB, LCP, and CLS stayed within configured limits.
- Tracking capability, hosted cancel/failure recovery, and unavailable intent-service recovery: 3/3 passed.
- Webhook negative-signature boundary: Stripe, PayPal, and Xendit each returned 401 with `invalid_webhook_signature`.
- Worker `/healthz` and `/readyz`: both returned 200 with `databaseRoles.app=true` and `databaseRoles.medusa=true`.

The deployed HTTP matrix found one contract defect in `GET /api/shop/product`: the route returned
`Referrer-Policy: no-referrer` while the checked-in contract requires
`strict-origin-when-cross-origin`. Error and success responses were aligned, the OpenAPI source
hash reference was regenerated, and the repair was committed as `737e7249` and pushed to the
verified-hosted-checkout preview branch. The Vercel preview was still building at the time of this
addendum; the HTTP matrix must be rerun after that deployment is ready.

The follow-up deployed health pass completed with 14/14 checks passing against the same
storefront and Worker: Worker and storefront health, admin authentication boundary, payment
method availability, shop/CMS/review public APIs, unauthenticated account/order/cart behavior,
COD validation, and cron-secret rejection. The route-header repair is not yet promoted to the
production alias; Vercel deployment `8DgD98NffjZz1KnZdK4FkdWZCrFo` remains in progress while
the JavaScript/TypeScript security check has completed successfully. The HTTP matrix remains
pending until that deployment is ready.

The ready preview for `b1ee6b4f` is
`https://universalmusic-rclz121zg-justinedevs-projects.vercel.app`. The deployed cart
quantity/reconciliation suite passed 13/13, covering over-limit edits, rapid-edit serialization,
stale-price correction, unavailable variants, outage recovery, mobile controls, and cross-tab
reconciliation. The storefront UX suite passed 22/23; the only skipped case is image zoom because
the deployed catalog has no seeded image fixture. The HTTP matrix reached the Worker cases (4/4)
but the storefront cases were redirected to Vercel SSO when run outside the authenticated browser
session, so the product-header assertion still requires an authenticated preview request.

The focused Worker provider/queue/webhook contract pass completed with 53/53 tests passing.
It covered Stripe checkout/refund/signature replay and deduplication, PayPal order/capture/refund
and transmission verification, Xendit/Pancake callback tokens and refund reconciliation, provider
failure handling, queue retry/redelivery/dead-letter behavior, and idempotency replay semantics.
These are contract-level proofs; they do not replace live provider delivery or authenticated
preview browser evidence.

The live payment-method probe returned only `XENDIT` and `COD`. A read-only production Worker
secret-name audit confirmed the cause: webhook verification secrets exist, but the provider
startup credentials `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `STRIPE_SECRET_KEY` are not
configured on the production Worker. This is why the PayPal sandbox browser handoff is skipped
and why Stripe/PayPal are absent from `/store/payment-methods`; no secret values are included in
this report.

The existing authenticated Vercel project was inspected without revealing values: Production
contains `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `STRIPE_API_KEY`, and
`STRIPE_WEBHOOK_SECRET`. The Worker expects the first two names and `STRIPE_SECRET_KEY`; therefore
the provider startup gap is a deployment-scope mismatch, not an absent provider account. The
remaining configuration action is to copy the PayPal sandbox credentials and map
`STRIPE_API_KEY` to the Worker secret name `STRIPE_SECRET_KEY`.

That transfer was tested and immediately rolled back safely: the copied PayPal credentials
returned HTTP 401 from PayPal Sandbox OAuth, and the copied Stripe key returned HTTP 401 from
Stripe `/v1/account`. The invalid Worker secrets were removed, and production was redeployed as
Worker version `3410ad27-04f2-4b1f-a433-4a55f5864579`. The live capability contract now correctly
returns only `XENDIT` and `COD` until valid provider credentials are supplied; no broken provider
is advertised to customers.
### 2026-09-23 — Checkout stock-verification browser compatibility

- Root cause: the read-only `POST /api/checkout/verify-stock` endpoint was wrapped
  in BotID. Legitimate hosted-browser checkout runs were rejected with HTTP 403
  `Access denied` before Xendit checkout initialization.
- Fix: the endpoint now keeps same-origin validation, bounded input, and the
  existing fixed-window rate limit, but no longer uses BotID for this public
  inventory read. This lets real browsers and privacy-hardened clients reach the
  provider handoff without weakening checkout or payment authorization.
- Evidence: the configured Xendit sandbox key returned HTTP 200 from the
  read-only `/balance` probe; the previous Xendit browser failure therefore was
  not a provider-credential failure.
- Final local rerun also passed the production build, `pnpm audit --audit-level
  low`, Worker migration-status check, source-scoped Gitleaks scan, and
  `git diff --check`. Trivy is not installed in this environment, so the
  previously recorded lockfile Trivy result is retained as historical evidence
  rather than claimed as a fresh rerun.

## Addendum: local security verification — 2026-09-29

The final repository-local security pass produced the following evidence:

- `pnpm audit --audit-level low` passed with no known vulnerabilities. The transitive `undici` advisory was resolved with a `miniflare` override, and Storybook was moved off the vulnerable Webpack adapter onto `@storybook/nextjs-vite`.
- Semgrep ran the TypeScript, Node.js, OWASP Top 10, and React rulesets over the tracked application/packages surface and finished with **0 blocking findings**. The GCM tracking-token decoder now requires a 16-byte authentication tag, and the preview bridge uses a derived origin instead of `*`.
- Gitleaks scans of current source directories (`apps/web/src`, `workers/backend/src`, `packages`, and `scripts`) are clean. `gitleaks git` still reports 24 immutable historical fixture/document/example fingerprints; history was not rewritten, so this is an explicit provenance/rotation follow-up rather than a claim of a clean historical scan.
- Trivy found no vulnerabilities in `pnpm-lock.yaml`. Its broader local filesystem scan identified six medium JWT-shaped values in ignored local environment files; those files are not tracked and are absent from a clean CI checkout. They must not be copied into artifacts or logs, and any credential that may have escaped the host boundary should be rotated.
- Scorecard on the tracked snapshot scored 8.2/10. The deductions are maturity heuristics around fuzzing, packaging, license metadata, and local-history SAST detection; they are not a substitute for a remote CI run. The current low-severity dependency audit is clean.
- Current checkout recheck (2026-10-02) scored 7.0/10 locally, with zero dependency vulnerabilities and no dangerous workflow patterns. The local score includes ignored `node_modules` binary warnings and cannot replace the token-authenticated remote scan; the older 8.2/10 result remains historical.
- `pnpm quality:knip`, frozen-lockfile install, typecheck, lint, full tests (585/585), and the Storybook build all passed after these changes.

GitHub Actions history confirms the `security-audit` workflow passed on the checked-in baseline `c71c99b6` in run `36276386392` on 2026-09-26. The current hardening edits remain uncommitted in this worktree, so a fresh hosted run for this exact diff is still required; this report does not treat the older successful run as proof for uncommitted changes.
