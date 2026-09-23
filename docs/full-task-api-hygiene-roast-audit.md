# Full Task API Hygiene, Contract, Route, and Product Truth Audit

Audit date: 2026-09-20
Repository: `/home/justine/Downloads/UVS`
Mode: implementation follow-up and evidence synthesis; findings are updated as fixes land, while externally gated evidence remains explicitly open.

## Current verification snapshot — 2026-09-23

The generated OpenAPI reference was regenerated after the source-drift gate
identified two stale route hashes. The current reference contains 278
operations, 320 executable schemas, and 598 matching route source hashes.
`pnpm quality:contracts` passes all local contract-boundary checks. This does
not replace deployed authenticated/provider evidence.

## Scope and method

This audit reads the checked-in OpenAPI references, maps documented operations to the Next.js App Router and Worker code, inspects UI route surfaces and integration boundaries, runs repository diagnostics, and compares the contract behavior with current standards. The route matrix is static triage, not runtime proof.

Legend:

- **V** — mutation lacks an obvious strict request-schema marker in the checked-in contract.
- **N** — mutation lacks an explicit idempotency marker in the contract.
- **S** — tenant/object scope is not obvious from generated metadata; this is not automatically a defect for global resources.
- **E** — raw error/message handling is visible in the route source or generated contract.
- **L** — bounded pagination/resource controls are not obvious from static source triage.
- **X** — export/import/data-extraction route.
- **H** — webhook/callback-specific trust model.
- **OK** — no issue detected by this static triage; not runtime-proven.

## Executive Verdict

This is not a thin AI wrapper. It is a real ecommerce and operations platform with substantial deterministic behavior: storefront and admin UI, checkout, payments, inventory, POS, CMS, RBAC, idempotency, audit logging, Cloudflare Worker routing, queues, Hyperdrive, Supabase persistence, and external integrations.

The principal weakness is not lack of functionality. It is contract truth and boundary hygiene:

- The admin OpenAPI inventory contains 276 operations, 318 executable schema entries, zero heuristic schema entries, zero unresolved/non-authoritative entries, and 594 source hashes; raw CSV exports are explicitly documented as binary responses.
- The consistency gate passes for 193 local admin operations, but it checks route/operation presence and metadata—not exact request/response schema fidelity.
- Request/response schemas are fully executable in the current reference: 318 entries are runtime-backed, with zero heuristic or unresolved entries. Security metadata remains explicitly source-inferred until executable authorization tests exist.
- Historical baseline: 13 embedded `x-source` handler snapshots differed from the current route files; the generator now emits only `x-source-path` plus SHA-256 fingerprints, so full handler snapshots are no longer duplicated in the contract artifact.
- The generator derives route inventory from the route tree and response schemas from route-owned executable contracts. Every operation now carries `x-contract-metadata-status: source-inferred` plus an explicit warning: permission, tenant scope, and replay fields are static source evidence, not executable authorization proof. Source SHA-256 fingerprints detect drift; no response schema is currently marked non-authoritative.
- The repository currently contains 205 Next route handlers and 60 Worker modules. The generated ownership manifest reports zero direct `web-platform-database` storefront routes and no direct admin database route; overlapping commerce/admin domains are Worker-owned through explicit proxies.
- UI inventory contains 92 pages. The route-state manifest now records seven state signals (loading, empty, blocked, unauthorized, failure, retry, success) for every page, but its evidence class is explicitly `static-inventory`; this still does not prove runtime behavior in a browser.
- The targeted web dead-surface cleanup removed the 3 unused files, unused web dependency, and dead web/SDK exports. A fresh unconfigured monorepo Knip scan still reports 20 entrypoint/config-like files, 2 package dependencies, 11 dev dependencies, 10 utility/test exports, and the deliberate system `act` binary; these require ownership/configuration review and are not claimed resolved.
- React Doctor reports 198 source warnings and 0 errors; the remaining warning backlog is tracked by category, with other security-sensitive items explicitly called out separately. The latest reduction also removes prop-adjustment effects from search and checkout initialization while preserving navigation reset behavior through keyed remounts.
- Docker has no running project containers; the stopped Act container is residue, not active runtime.

Judgment scores based on repository evidence:

| Dimension | Judgment |
|---|---:|
| Thin AI wrapper | No |
| Prompt-replicable value | 0–5% |
| Real system value | 95–100% |
| Honesty score | 6/10 |
| Differentiation score | 6/10 |
| Production-readiness from this checkout | 7/10, conditional |

The product is operationally real, but claims such as “strict OpenAPI contract,” “all backend contracts execute in the Worker,” and unqualified “production-ready” are stronger than the current evidence.

## Claims Table

| Claim | Status | Evidence | Enforced? | Misleading? | Recommendation |
|---|---|---|---|---|---|
| Worker-native backend is the complete backend runtime | Real but partial / boundary conflict | `AGENTS.md:40-61`, `wrangler.jsonc`, `workers/backend/src/index.ts` | Worker routes, queues, and Hyperdrive are real | Yes if read as “no meaningful Next server API remains” | Define one authoritative backend boundary and classify each Next route as proxy, frontend-only BFF, or migration debt. |
| Admin API is implemented and route-consistent | Real but narrow | `stress-test/scripts/check-admin-openapi.mjs`; gate output: 193 operations match; 594 source hashes | Route/method presence, executable body/response schemas, and source drift are checked; security metadata is explicitly source-inferred | Yes if interpreted as full auth/scope/replay proof | Keep executable route metadata declarations and operation-level auth/scope/replay tests as the remaining contract lane. |
| Admin OpenAPI has executable request/response schemas | Resolved for schema authority; semantic runtime proof remains partial | `scripts/generate-admin-openapi-docs.mjs`; current reference has 318 executable schema entries, zero heuristic entries, zero unresolved entries, and 594 matching source hashes | Schema authority and source drift are gated; exact route-by-route runtime status/body semantics and authorization are not all browser/provider-proven | Add route-family runtime contract tests and deployed authenticated evidence; do not label this as universal production proof | Keep generated reference, route-owned contracts, and runtime tests in the same change. |
| All admin endpoints have authentication, permissions, audit, and validation | Real but partial | `apps/web/src/lib/requireStaffSession.ts`, `admin-mutation-idempotency.ts`, Worker guards; direct route inventory | Guards exist, but static metadata cannot prove every branch and audit path | Yes as an absolute statement | Add per-route executable assertions for auth, scope, audit, validation, and error media type. |
| Every mutation has durable replay protection | Real but partial | Idempotency helpers and Worker stores; OpenAPI has 118 required markers across all operations | Many admin mutations are protected; metadata marks some global mutations as not required | Potentially | Make idempotency policy explicit by operation class and test duplicate/concurrent requests. |
| RFC-style problem responses are standardized | Real but partial | `apps/web/src/lib/staff-api-response.ts`; `ProblemResponse` in OpenAPI | Helper emits `application/problem+json`; not every handler is proven to use it | Yes if claimed globally | Enforce response wrapping at the route boundary and contract-test all declared 4xx/5xx responses. |
| Pancake OpenAPI is the local API | False if interpreted locally | `internal/reference/pancake-open-api.yaml`: 102 external operations; local client exposes a bounded resource subset | Local integration uses selected resources through `pancake-client.ts` | Yes | Label it “external Pancake POS reference”; publish a separate local adapter contract. |
| Pancake integration is real | Real but partial | `apps/web/src/lib/pancake-client.ts`, `apps/web/src/lib/pancake-client.test.ts`, admin integration route, Worker provider/webhook tests | API key, resource allowlist, shop ID, timeout/retry/size/pagination controls, and provider callbacks exist | No, if labeled partial | Add capability discovery, typed resource response schemas, and provider-backed authenticated proof. |
| UI covers the full admin/storefront surface | Real but unverified | 92 page files and generated `docs/route-state-manifest.json` | Static state inventory exists for all seven required state classes | Yes if static signals are treated as runtime proof | Add authenticated browser evidence for each critical page/state; static inventory is not a substitute. |
| Training demos represent production behavior | Surface-level by design | `apps/web/src/app/(dashboard)/admin/docs/page.tsx:597-598`, `apps/web/public/guide-demos` | They are explicitly labeled mock/demo | No if labels remain visible | Keep isolated and prevent demo URLs from being used as production evidence. |
| Docker is part of deployed backend runtime | False | `AGENTS.md:61`, `README.md:31,92`; no running containers | Deployment is Vercel + Cloudflare Worker | Yes if docs imply otherwise | Remove stale Docker assumptions from scripts/docs except diagnostics and CI tooling. |
| Production readiness is proven | Partial / conditional | `docs/production-hardening-report.md`; prior local gates passed, hosted provider/database proof remains limited | Static/build/test gates exist | Yes if unqualified | Use explicit release labels: static-green, preview-verified, provider-sandbox-verified, production-verified. |

## Differentiation Table

| Area | Real? | User-visible? | Hard to replicate? | Strategic value |
|---|---|---|---|---|
| Commerce domain logic | Yes | Yes | Medium/high | Core product value; not prompt-replicable. |
| Cloudflare Worker backend with queues and two database roles | Yes | Indirectly | Medium | Strong operational boundary if made authoritative. |
| Durable idempotency and replay handling | Yes, partial coverage | Indirectly | High when consistently enforced | High for payments, inventory, POS, and fulfillment. |
| Staff RBAC, organization resolution, audit logging | Yes | Yes in admin behavior | Medium/high | Trust and operational governance. |
| Offline POS and terminal/printer integration | Yes | Yes | High | Meaningful domain differentiation. |
| Payment/provider abstraction | Yes | Yes | Medium | Useful, but provider integrations need stronger proof. |
| CMS and visual builder | Yes | Yes | Medium | Product value; current contract and state coverage are weak points. |
| Pancake logistics bridge | Yes, bounded | Yes in integrations/admin | Medium | Differentiates local operating workflow, not a moat by itself. |
| OpenAPI source embedding | Technically real, strategically weak | No | Easy to replicate | False moat; it increases drift risk. |
| Generated source-regex schemas | Partial | No | Easy to replicate | Not a defensible contract strategy. |
| Static quality gates | Yes | No | Medium | Useful release discipline, but not production proof alone. |
| AI/autonomy/multi-agent moat | No evidence in this product scope | No | Prompt/script replicable | Do not claim this as the ecommerce platform’s moat. |

## Thin-Wrapper Findings

1. The contract generator is a text-extraction wrapper around route source. `extractZodProperties()` and `extractResponseProperties()` use regexes, so imported schemas, nested schemas, refinements, unions, requiredness, formats, enums, arrays, and actual response variants are not faithfully represented.
2. Historical YAML versions stored full `x-source` code snapshots. This duplicated source and created stale snapshots; the current generator emits source paths and hashes only, with a drift gate over the live route tree.
3. The OpenAPI gate verifies structural route inventory and metadata, not executable request/response compatibility.
4. The 102-operation Pancake file is an external provider reference, not 102 locally supported endpoints. The local integration intentionally supports only a bounded allowlist.
5. UI training demos contain mock data by design. They are not product proof and must remain clearly segregated.
6. The presence of a generated PDF and YAML does not establish deployed API documentation or client-generation compatibility; no runtime documentation endpoint was found.
7. “All routes” claims are now backed by 205 Next handlers plus Worker routes with zero direct platform-database route handlers and no direct admin database handlers. This proves repository ownership alignment, not deployed/provider-backed behavior; deployed proof remains required before calling the backend production-proven.

## Real-Value Findings

1. The Next.js App Router is a real storefront/admin application with 92 page files and direct public/admin flows.
2. Cloudflare Worker entrypoint `workers/backend/src/index.ts` handles fetch and queue events and exports domain handlers.
3. `wrangler.jsonc` defines separate dev/production Worker names, two Hyperdrive bindings, commerce queues, dead-letter queues, and deleted legacy Durable Object exports.
4. Supabase Auth SSR and staff permission checks are implemented in `apps/web/src/lib/requireStaffSession.ts`.
5. Admin mutation idempotency persists claims/results and audits outcomes in `apps/web/src/lib/admin-mutation-idempotency.ts`.
6. Payment, checkout, inventory, POS, catalog, CMS, CRM, fulfillment, and webhook modules contain deterministic code and tests.
7. Worker tests cover route handlers and domain modules; the repository has real test evidence, though not complete deployed proof.
8. The integration surface includes Stripe, PayPal, Xendit, COD, Resend, Pancake POS, Supabase, Hyperdrive, Queues, PostHog, Vercel Analytics, and printer/terminal support.

## Risk Findings

### Contract and documentation risks

- **Resolved:** generated OpenAPI contains 318 executable schema entries and zero heuristic or unresolved entries. Authorization metadata remains a separate executable-test workstream.
- **Resolved:** stale embedded source snapshots were removed; the current YAML contains source paths and 594 source hashes, verified against the route tree.
- **High:** OpenAPI operation metadata is heuristic. `contractMetadata()` infers permission, tenant scope, and idempotency from source text.
- **Medium:** global OpenAPI security and per-operation security are duplicated, increasing noise.
- **Resolved with a bounded evidence marker:** every generated operation now includes `x-runtime-statuses`, derived from literal route status branches and checked by the OpenAPI gate; full semantic response-body/status contract tests remain a separate runtime-verification concern.

### Runtime-boundary risks

- **Resolved:** All 205 Next route handlers are now classified as Worker-owned, service-boundary, or web-runtime-only; none is direct-database-owned. Cart abandonment, review mutations, and receipt upload now execute through Worker-owned database/storage/email boundaries with signed forwarding, independent validation, bounded inputs, cleanup, and durable deduplication where applicable. The remaining release gap is deployed/provider evidence, not repository ownership. The CMS page collection, detail, mutation-history, navigation, navigation publish, announcement, blog collection/detail, blog bulk/export, block-presets lifecycle, form-settings lifecycle, experiments lifecycle, components lifecycle, redirects lifecycle, CRM notes and operations lifecycles, delivery logistics operations, payment-health, payment-attempts export, checkout loyalty-balance, audit-log, commerce-recovery-metrics, inventory-ledger, cycle-count lifecycle, purchase-order lifecycle, transfer lifecycle, admin-review-list, admin-roles, admin-tasks-today, admin-integration-health, admin-loyalty-lookup, admin-loyalty accounts/points/rewards, admin-payments, admin-payment-capabilities, admin-profile, storefront metadata, runtime settings, offline queue, devices, review moderation, operator notes, customer segments, employees, and campaigns routes are now Worker-owned with bounded, tenant-scoped reads where applicable, revision-aware updates where applicable, and durable idempotent mutations where applicable.
- **Medium:** the Worker bridge assumes `API_URL`, obtains a Supabase session token, and then calls the Worker. Missing API URL or token returns null, which can turn backend failure into route-specific fallback behavior.
- **Medium:** `workers/backend/src/router.ts` is approximately 80 KB and centralizes many route decisions; this is a maintainability and change-risk hotspot.

### Resource and security risks

- **High:** 54 admin GET operations lack obvious static pagination/resource bounds. This is a triage signal, not proof that every route is unbounded.
- **High:** export/import surfaces require separate bounded-size, row-count, authorization, and streaming controls.
- **Resolved for DSAR export:** the Worker compliance export now applies explicit per-collection row caps across APP and Medusa data and returns the active limits in the export contract; `compliance.test.ts` verifies the bounded SQL and response metadata. CSV admin exports already enforce row/byte caps; large asynchronous export jobs remain a future scale path beyond the current hard limits.
- **Medium:** 18 admin routes expose source-visible error/message patterns. Some are safe domain messages; each should be checked against RFC 9457 and sensitive-data policy.
- **Medium:** 85 admin operations are marked non-tenant-scoped. Some are correctly global, but the generated field is too coarse to prove object-level authorization.
- **Medium:** provider-backed Pancake execution remains externally unverified, but the local adapter now enforces a 10-second timeout, two-attempt transient retry budget, 2 MiB response cap, HTTPS base URL validation, pagination clamps, and generic error redaction (`pancake-client.test.ts`).
- **Resolved:** shared web-to-Worker JSON decoding is now streaming and byte-bounded (1 MiB default), with safe fallback on malformed or oversized bodies and focused regression coverage.
- **Resolved:** the admin Worker bridge now routes all 11 response paths through the bounded decoder; no direct `response.json()` calls remain in that bridge.
- **Resolved:** the catalog Worker fetcher also routes list and detail responses through the same bounded decoder.
- **Resolved:** public proxy, cart, checkout, and channel-event adapters now use the bounded decoder; direct response parsing was removed from all four adapters.
- **Resolved:** POS catalog, inventory guard, and account-order adapters now use the bounded decoder as well.
- **Resolved:** the remaining web server adapters and API proxy routes now use the same streaming, byte-bounded decoder; the residual response-read inventory is limited to test assertions and inbound `request.json()` parsing.
- **Resolved:** the admin delivery-operations read now uses explicit courier and open-exception projections with tenant filters and 200-row caps instead of `SELECT *`; mutation responses remain separately contract-validated.
- **Resolved:** the Worker CMS category, CMS page lock, and delivery-logistics list paths now use explicit column projections instead of `SELECT *`; focused regressions assert the production queries remain projected.
- **Resolved:** campaign listing uses an explicit projection with a 500-row cap, and segment-member detail reads are capped at 10,000 rows; campaign execution remains paged at 500 rows rather than materializing an unbounded audience.
- **Medium:** the repository has 198 source React Doctor warnings; the current zero-error result does not mean warning-free hygiene. The highest-confidence JSON-LD, preview-iframe, upstream-response, URL-validation, admin-form accessibility, placeholder-only field, stale-load, stuck-loading, retry/error-state, re-entry, numeric-input, static-I/O, loading-finalization, repeated formatter construction, linear lookup, broad-transition, unstable-key, locale/timezone determinism, redundant map/filter, state-updater side-effect, analytics aggregation, independent-await, internal-navigation, visual-builder sandbox bridge, and CMS mutation re-entry findings are resolved with shared serialization, sandbox boundaries, status-aware parsing, explicit control labels, cancellation, finally-based cleanup, bounded parallel work, deterministic formatting, and regression coverage. CI now enforces a non-regression budget of 286 warnings via `REACT_DOCTOR_WARNING_BUDGET`.
- **Resolved at the architectural boundary:** React Doctor’s two webhook-signature warnings are false positives for the Next routes. The Next handlers are deliberately secretless signed proxies; `scripts/check-webhook-proxy-boundary.mjs` now proves required signature/replay headers are forwarded and that the Cloudflare Worker verifies signatures and persists replay protection in `workers/backend/src/channel-events-admin.ts` and `workers/backend/src/nango-webhook.ts`. This check runs in `quality:contracts`.
- **Resolved:** the main CMS storefront editor now uses `sandbox="allow-scripts"`; selection, mutation, frame state, and CSS-variable discovery cross the iframe through validated `postMessage` contracts, eliminating the same-origin DOM bridge.
- **Low/medium:** the targeted web dead surfaces are removed, but the unconfigured monorepo scan still contains entrypoint/config false-positive candidates and package-level dependency cleanup work. `act` remains an intentional system-provided local-CI executable.

### Evidence and product truth risks

- Hosted authenticated browser evidence, provider-backed payment/webhook proof, and production database/SQL evidence are not equivalent to local tests.
- The route-state gate now verifies loading and error boundaries for all 92 pages; route-specific empty, blocked, unauthorized, retry, and success coverage remains unproven.
- A page existing in the App Router does not prove direct-load, refresh, unauthorized, empty, blocked, retry, and success behavior.
- No evidence was found for a deployed OpenAPI documentation surface.

## Route-Level Roast Matrix

### Local OpenAPI operations

The following matrix covers every operation in `internal/reference/admin-open-api.yaml`. The 193 `/admin/*` operations are locally gate-checked; the remaining operations are other unified-app API routes also present in the same reference.

| Method | Route | Flags | Permission metadata | Tenant metadata | Idempotency metadata | Runtime source |
|---|---|---|---|---|---|---|
| GET | `/account/loyalty` | S,E | internal-signature | False | False | `apps/web/src/app/api/account/loyalty/route.ts` |
| GET | `/account/marketing-preferences` | S,L | internal-signature | False | False | `apps/web/src/app/api/account/marketing-preferences/route.ts` |
| PATCH | `/account/marketing-preferences` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/account/marketing-preferences/route.ts` |
| GET | `/account/order-preferences` | S,L | internal-signature | False | False | `apps/web/src/app/api/account/order-preferences/route.ts` |
| PATCH | `/account/order-preferences` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/account/order-preferences/route.ts` |
| POST | `/account/orders/{orderId}/cancel` | V,S | internal-signature | False | True | `apps/web/src/app/api/account/orders/[orderId]/cancel/route.ts` |
| POST | `/account/privacy/erasure` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/account/privacy/erasure/route.ts` |
| GET | `/account/privacy/export` | S,X | internal-signature | False | False | `apps/web/src/app/api/account/privacy/export/route.ts` |
| PATCH | `/account/profile` | V,N,S,E | internal-signature | False | False | `apps/web/src/app/api/account/profile/route.ts` |
| GET | `/account/profile/status` | S,E,L | internal-signature | False | False | `apps/web/src/app/api/account/profile/status/route.ts` |
| GET | `/admin/analytics/clv` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/analytics/clv/route.ts` |
| GET | `/admin/analytics/retention` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/analytics/retention/route.ts` |
| GET | `/admin/analytics/sales-trends` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/analytics/sales-trends/route.ts` |
| GET | `/admin/audit-logs` | L,S | Worker bearer + dashboard:read / analytics:export | True | False | `apps/web/src/app/api/admin/audit-logs/route.ts` → `workers/backend/src/audit-admin.ts` |
| GET | `/admin/campaigns` | L | campaigns:read | True | False | `apps/web/src/app/api/admin/campaigns/route.ts` |
| POST | `/admin/campaigns` | OK | worker-bearer campaigns:write | True | True | `apps/web/src/app/api/admin/campaigns/route.ts` |
| GET | `/admin/campaigns/{id}` | OK | worker-bearer campaigns:read | True | False | `apps/web/src/app/api/admin/campaigns/[id]/route.ts` |
| PATCH | `/admin/campaigns/{id}` | OK | worker-bearer campaigns:write | True | True | `apps/web/src/app/api/admin/campaigns/[id]/route.ts` |
| POST | `/admin/campaigns/{id}/execute` | OK | worker-bearer campaigns:execute | True | True | `apps/web/src/app/api/admin/campaigns/[id]/execute/route.ts` |
| GET | `/admin/catalog/categories` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/catalog/categories/route.ts` |
| POST | `/admin/catalog/categories` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/catalog/categories/route.ts` |
| GET | `/admin/catalog/media` | OK | catalog:write | True | False | `apps/web/src/app/api/admin/catalog/media/route.ts` |
| POST | `/admin/catalog/media` | V | catalog:write | True | True | `apps/web/src/app/api/admin/catalog/media/route.ts` |
| POST | `/admin/catalog/products` | V,S,E | staff-session | False | True | `apps/web/src/app/api/admin/catalog/products/route.ts` |
| DELETE | `/admin/catalog/products/{id}` | V,E | staff-session | True | True | `apps/web/src/app/api/admin/catalog/products/[id]/route.ts` |
| PATCH | `/admin/catalog/products/{id}` | V,E | staff-session | True | True | `apps/web/src/app/api/admin/catalog/products/[id]/route.ts` |
| GET | `/admin/catalog/products/suggestions` | S | staff-session | False | False | `apps/web/src/app/api/admin/catalog/products/suggestions/route.ts` |
| GET | `/admin/channels/events` | S | channels:manage | False | False | `apps/web/src/app/api/admin/channels/events/route.ts` |
| POST | `/admin/channels/events/{id}/process` | V,S | channels:manage | False | True | `apps/web/src/app/api/admin/channels/events/[id]/process/route.ts` |
| POST | `/admin/chat-orders/{id}/status` | V,S | chat_orders:manage | False | True | `apps/web/src/app/api/admin/chat-orders/[id]/status/route.ts` |
| GET | `/admin/chat-orders/variant-suggestions` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/chat-orders/variant-suggestions/route.ts` |
| DELETE | `/admin/cms/announcement` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/announcement/route.ts` |
| GET | `/admin/cms/announcement` | L | content:read | True | False | `apps/web/src/app/api/admin/cms/announcement/route.ts` |
| PUT | `/admin/cms/announcement` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/announcement/route.ts` |
| GET | `/admin/cms/block-presets` | OK | staff-session | True | False | `apps/web/src/app/api/admin/cms/block-presets/route.ts` |
| POST | `/admin/cms/block-presets` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/block-presets/route.ts` |
| DELETE | `/admin/cms/block-presets/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/block-presets/[id]/route.ts` |
| GET | `/admin/cms/blog` | L | content:read | True | False | `apps/web/src/app/api/admin/cms/blog/route.ts` |
| POST | `/admin/cms/blog` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/blog/route.ts` |
| DELETE | `/admin/cms/blog/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/blog/[id]/route.ts` |
| GET | `/admin/cms/blog/{id}` | L | staff-session | True | False | `apps/web/src/app/api/admin/cms/blog/[id]/route.ts` |
| PUT | `/admin/cms/blog/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/blog/[id]/route.ts` |
| POST | `/admin/cms/blog/bulk` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/blog/bulk/route.ts` |
| GET | `/admin/cms/blog/export` | X | staff-session | True | False | `apps/web/src/app/api/admin/cms/blog/export/route.ts` |
| GET | `/admin/cms/category-content` | S,L | internal-signature | False | False | `apps/web/src/app/api/admin/cms/category-content/route.ts` |
| POST | `/admin/cms/category-content` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/cms/category-content/route.ts` |
| GET | `/admin/cms/category-content/catalog-categories` | S,L | internal-signature | False | False | `apps/web/src/app/api/admin/cms/category-content/catalog-categories/route.ts` |
| GET | `/admin/cms/category-content/catalog-gaps` | S,L | internal-signature | False | False | `apps/web/src/app/api/admin/cms/category-content/catalog-gaps/route.ts` |
| POST | `/admin/cms/category-content/sync-from-catalog` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/cms/category-content/sync-from-catalog/route.ts` |
| GET | `/admin/cms/components` | L | content:read | True | False | `apps/web/src/app/api/admin/cms/components/route.ts` |
| POST | `/admin/cms/components` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/components/route.ts` |
| DELETE | `/admin/cms/components/{id}` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/components/[id]/route.ts` |
| GET | `/admin/cms/components/{id}` | L | content:read | True | False | `apps/web/src/app/api/admin/cms/components/[id]/route.ts` |
| PATCH | `/admin/cms/components/{id}` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/components/[id]/route.ts` |
| POST | `/admin/cms/components/{id}` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/components/[id]/route.ts` |
| GET | `/admin/cms/experiments` | L | content:read | True | False | `apps/web/src/app/api/admin/cms/experiments/route.ts` |
| POST | `/admin/cms/experiments` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/experiments/route.ts` |
| PUT | `/admin/cms/experiments/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/experiments/[id]/route.ts` |
| GET | `/admin/cms/forms/settings` | L | staff-session | True | False | `apps/web/src/app/api/admin/cms/forms/settings/route.ts` |
| PUT | `/admin/cms/forms/settings` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/forms/settings/route.ts` |
| GET | `/admin/cms/forms/submissions` | OK | staff-session | True | False | `apps/web/src/app/api/admin/cms/forms/submissions/route.ts` |
| PATCH | `/admin/cms/forms/submissions/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/forms/submissions/[id]/route.ts` |
| GET | `/admin/cms/forms/submissions/export` | X | staff-session | True | False | `apps/web/src/app/api/admin/cms/forms/submissions/export/route.ts` |
| GET | `/admin/cms/media` | OK | staff-session | True | False | `apps/web/src/app/api/admin/cms/media/route.ts` |
| POST | `/admin/cms/media` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/media/route.ts` |
| DELETE | `/admin/cms/media/{id}` | V,E | staff-session | True | True | `apps/web/src/app/api/admin/cms/media/[id]/route.ts` |
| GET | `/admin/cms/media/{id}` | E,L | staff-session | True | False | `apps/web/src/app/api/admin/cms/media/[id]/route.ts` |
| PATCH | `/admin/cms/media/{id}` | V,E | staff-session | True | True | `apps/web/src/app/api/admin/cms/media/[id]/route.ts` |
| GET | `/admin/cms/navigation` | L | content:read | True | False | `apps/web/src/app/api/admin/cms/navigation/route.ts` |
| PUT | `/admin/cms/navigation` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/navigation/route.ts` |
| POST | `/admin/cms/navigation/publish` | V | content:publish | True | True | `apps/web/src/app/api/admin/cms/navigation/publish/route.ts` |
| GET | `/admin/cms/pages` | OK | content:read | True | False | `apps/web/src/app/api/admin/cms/pages/route.ts` |
| POST | `/admin/cms/pages` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/pages/route.ts` |
| DELETE | `/admin/cms/pages/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/pages/[id]/route.ts` |
| GET | `/admin/cms/pages/{id}` | OK | staff-session | True | False | `apps/web/src/app/api/admin/cms/pages/[id]/route.ts` |
| PUT | `/admin/cms/pages/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/pages/[id]/route.ts` |
| GET | `/admin/cms/pages/{id}/mutations` | OK | content:read | True | False | `apps/web/src/app/api/admin/cms/pages/[id]/mutations/route.ts` |
| GET | `/admin/cms/redirects` | L | content:read | True | False | `apps/web/src/app/api/admin/cms/redirects/route.ts` |
| POST | `/admin/cms/redirects` | V | content:read | True | True | `apps/web/src/app/api/admin/cms/redirects/route.ts` |
| DELETE | `/admin/cms/redirects/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/redirects/[id]/route.ts` |
| PUT | `/admin/cms/redirects/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/redirects/[id]/route.ts` |
| PATCH | `/admin/cms/redirects/bulk` | V | staff-session | True | True | `apps/web/src/app/api/admin/cms/redirects/bulk/route.ts` |
| GET | `/admin/cms/redirects/export` | X | staff-session | True | False | `apps/web/src/app/api/admin/cms/redirects/export/route.ts` |
| POST | `/admin/cms/redirects/import` | V,X | staff-session | True | True | `apps/web/src/app/api/admin/cms/redirects/import/route.ts` |
| GET | `/admin/cms/redirects/resolve` | L | staff-session | True | False | `apps/web/src/app/api/admin/cms/redirects/resolve/route.ts` |
| GET | `/admin/commerce-recovery-metrics` | L,S | dashboard:read | True | False | `apps/web/src/app/api/admin/commerce-recovery-metrics/route.ts` → `workers/backend/src/payment-recovery-admin.ts` |
| GET | `/admin/commerce/products/lookup` | S | staff-session | False | False | `apps/web/src/app/api/admin/commerce/products/lookup/route.ts` |
| GET | `/admin/commerce/products/search` | S | staff-session | False | False | `apps/web/src/app/api/admin/commerce/products/search/route.ts` |
| GET | `/admin/cost-visibility` | S | dashboard:read | False | False | `apps/web/src/app/api/admin/cost-visibility/route.ts` |
| GET | `/admin/crm/bridge` | OK | staff-session | True | False | `apps/web/src/app/api/admin/crm/bridge/route.ts` |
| POST | `/admin/crm/bridge` | V | staff-session | True | True | `apps/web/src/app/api/admin/crm/bridge/route.ts` |
| DELETE | `/admin/crm/nango` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/crm/nango/route.ts` |
| GET | `/admin/crm/nango` | S,L | internal-signature | False | False | `apps/web/src/app/api/admin/crm/nango/route.ts` |
| POST | `/admin/crm/nango` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/crm/nango/route.ts` |
| POST | `/admin/crm/nango/connect-session` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/crm/nango/connect-session/route.ts` |
| GET | `/admin/crm/notes` | OK | staff-session | True | False | `apps/web/src/app/api/admin/crm/notes/route.ts` **STALE EMBEDDED SOURCE** |
| POST | `/admin/crm/notes` | OK | staff-session | True | True | `apps/web/src/app/api/admin/crm/notes/route.ts` **STALE EMBEDDED SOURCE** |
| DELETE | `/admin/crm/notes/{id}` | V | staff-session | True | True | `apps/web/src/app/api/admin/crm/notes/[id]/route.ts` **STALE EMBEDDED SOURCE** |
| DELETE | `/admin/crm/operations` | E | staff-session | True | True | `apps/web/src/app/api/admin/crm/operations/route.ts` |
| GET | `/admin/crm/operations` | E | staff-session | True | False | `apps/web/src/app/api/admin/crm/operations/route.ts` |
| PATCH | `/admin/crm/operations` | E | staff-session | True | True | `apps/web/src/app/api/admin/crm/operations/route.ts` |
| POST | `/admin/crm/operations` | E | staff-session | True | True | `apps/web/src/app/api/admin/crm/operations/route.ts` |
| GET | `/admin/delivery-logistics` | L | dashboard:read | True | False | `apps/web/src/app/api/admin/delivery-logistics/route.ts` |
| GET | `/admin/delivery-logistics/operations` | S,E | staff-session | False | False | `apps/web/src/app/api/admin/delivery-logistics/operations/route.ts` |
| POST | `/admin/delivery-logistics/operations` | S,E | staff-session | False | True | `apps/web/src/app/api/admin/delivery-logistics/operations/route.ts` |
| GET | `/admin/delivery-logistics/shipments` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/delivery-logistics/shipments/route.ts` |
| POST | `/admin/delivery-logistics/shipments` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/delivery-logistics/shipments/route.ts` |
| GET | `/admin/devices` | L | devices:manage | True | False | `apps/web/src/app/api/admin/devices/route.ts` |
| POST | `/admin/devices` | OK | devices:manage | True | True | `apps/web/src/app/api/admin/devices/route.ts` |
| PATCH | `/admin/devices/{id}` | OK | staff-session | True | True | `apps/web/src/app/api/admin/devices/[id]/route.ts` |
| GET | `/admin/employees` | S,L | employees:read | False | False | `apps/web/src/app/api/admin/employees/route.ts` |
| POST | `/admin/employees` | V,S | employees:write | False | True | `apps/web/src/app/api/admin/employees/route.ts` |
| DELETE | `/admin/employees/{id}` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/employees/[id]/route.ts` |
| GET | `/admin/employees/{id}` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/employees/[id]/route.ts` |
| PATCH | `/admin/employees/{id}` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/employees/[id]/route.ts` |
| POST | `/admin/employees/{id}/pin` | S | staff-session | False | True | `apps/web/src/app/api/admin/employees/[id]/pin/route.ts` |
| PUT | `/admin/employees/{id}/pin` | S | staff-session | False | True | `apps/web/src/app/api/admin/employees/[id]/pin/route.ts` |
| GET | `/admin/feature-mappings` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/feature-mappings/route.ts` |
| GET | `/admin/integration-health` | L | settings:read | False | False | `apps/web/src/app/api/admin/integration-health/route.ts` → `workers/backend/src/integration-health-admin.ts` |
| GET | `/admin/integrations/pancake` | S,E,L | settings:read | False | False | `apps/web/src/app/api/admin/integrations/pancake/route.ts` |
| GET | `/admin/inventory` | S | inventory:read | False | False | `apps/web/src/app/api/admin/inventory/route.ts` |
| POST | `/admin/inventory/adjust` | S | staff-session | False | True | `apps/web/src/app/api/admin/inventory/adjust/route.ts` |
| GET | `/admin/inventory/cycle-counts` | OK | inventory:read | True | False | `apps/web/src/app/api/admin/inventory/cycle-counts/route.ts` |
| POST | `/admin/inventory/cycle-counts` | OK | inventory:read | True | True | `apps/web/src/app/api/admin/inventory/cycle-counts/route.ts` |
| GET | `/admin/inventory/cycle-counts/{id}` | L | inventory:read | True | False | `apps/web/src/app/api/admin/inventory/cycle-counts/[id]/route.ts` |
| POST | `/admin/inventory/cycle-counts/{id}` | OK | inventory:read | True | True | `apps/web/src/app/api/admin/inventory/cycle-counts/[id]/route.ts` |
| GET | `/admin/inventory/ledger` | L,S | inventory:read | True | False | `apps/web/src/app/api/admin/inventory/ledger/route.ts` → `workers/backend/src/inventory-ledger-admin.ts` |
| GET | `/admin/inventory/purchase-orders` | OK | inventory:read | True | False | `apps/web/src/app/api/admin/inventory/purchase-orders/route.ts` |
| POST | `/admin/inventory/purchase-orders` | OK | inventory:read | True | True | `apps/web/src/app/api/admin/inventory/purchase-orders/route.ts` |
| GET | `/admin/inventory/purchase-orders/{id}` | L | inventory:read | True | False | `apps/web/src/app/api/admin/inventory/purchase-orders/[id]/route.ts` |
| POST | `/admin/inventory/purchase-orders/{id}` | OK | inventory:read | True | True | `apps/web/src/app/api/admin/inventory/purchase-orders/[id]/route.ts` |
| GET | `/admin/inventory/reservations` | L | inventory:read | True | False | `apps/web/src/app/api/admin/inventory/reservations/route.ts` **STALE EMBEDDED SOURCE** |
| POST | `/admin/inventory/reservations` | OK | inventory:read | True | True | `apps/web/src/app/api/admin/inventory/reservations/route.ts` **STALE EMBEDDED SOURCE** |
| POST | `/admin/inventory/reservations/{id}` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/inventory/reservations/[id]/route.ts` |
| GET | `/admin/inventory/stream` | S | inventory:read | False | False | `apps/web/src/app/api/admin/inventory/stream/route.ts` |
| GET | `/admin/inventory/transfers` | OK | inventory:read | True | False | `apps/web/src/app/api/admin/inventory/transfers/route.ts` |
| POST | `/admin/inventory/transfers` | OK | inventory:read | True | True | `apps/web/src/app/api/admin/inventory/transfers/route.ts` |
| GET | `/admin/inventory/transfers/{id}` | L | inventory:read | True | False | `apps/web/src/app/api/admin/inventory/transfers/[id]/route.ts` |
| POST | `/admin/inventory/transfers/{id}` | OK | inventory:read | True | True | `apps/web/src/app/api/admin/inventory/transfers/[id]/route.ts` |
| GET | `/admin/invoices` | S,L | receipts:read | False | False | `apps/web/src/app/api/admin/invoices/route.ts` |
| POST | `/admin/invoices` | V,S | receipts:read | False | True | `apps/web/src/app/api/admin/invoices/route.ts` |
| POST | `/admin/invoices/{id}/lifecycle` | S | receipts:send | False | True | `apps/web/src/app/api/admin/invoices/[id]/lifecycle/route.ts` |
| GET | `/admin/loyalty` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/loyalty/route.ts` |
| POST | `/admin/loyalty` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/loyalty/route.ts` |
| GET | `/admin/loyalty/lookup` | L | loyalty:read | False | False | `apps/web/src/app/api/admin/loyalty/lookup/route.ts` → `workers/backend/src/loyalty-admin.ts` |
| POST | `/admin/loyalty/points` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/loyalty/points/route.ts` |
| GET | `/admin/loyalty/rewards` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/loyalty/rewards/route.ts` |
| POST | `/admin/loyalty/rewards` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/loyalty/rewards/route.ts` |
| GET | `/admin/offline-queue` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/offline-queue/route.ts` |
| PATCH | `/admin/offline-queue` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/offline-queue/route.ts` |
| POST | `/admin/offline-queue` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/offline-queue/route.ts` |
| GET | `/admin/operator-notes` | S | staff-session | False | False | `apps/web/src/app/api/admin/operator-notes/route.ts` |
| POST | `/admin/operator-notes` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/operator-notes/route.ts` |
| POST | `/admin/orders/{orderId}/refund` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/orders/[orderId]/refund/route.ts` |
| PATCH | `/admin/orders/{orderId}/status` | S | orders:write | False | True | `apps/web/src/app/api/admin/orders/[orderId]/status/route.ts` |
| POST | `/admin/orders/bulk-fulfill` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/orders/bulk-fulfill/route.ts` |
| GET | `/admin/payment-attempts/export` | X | analytics:export | True | False | `apps/web/src/app/api/admin/payment-attempts/export/route.ts` |
| GET | `/admin/payment-health` | L | payments:read | True | False | `apps/web/src/app/api/admin/payment-health/route.ts` |
| GET | `/admin/payments` | L | dashboard:read | False | False | `apps/web/src/app/api/admin/payments/route.ts` → `workers/backend/src/payments-admin.ts` |
| POST | `/admin/payments/{id}/mark-review` | V,S | orders:write | False | True | `apps/web/src/app/api/admin/payments/[id]/mark-review/route.ts` |
| POST | `/admin/payments/{id}/retry` | V,S | orders:write | False | True | `apps/web/src/app/api/admin/payments/[id]/retry/route.ts` |
| GET | `/admin/payments/capabilities` | L | settings:read | False | False | `apps/web/src/app/api/admin/payments/capabilities/route.ts` → `workers/backend/src/payment-capabilities-admin.ts` |
| PATCH | `/admin/profile` | V,S | settings:write | False | True | `apps/web/src/app/api/admin/profile/route.ts` → `workers/backend/src/profile-admin.ts` |
| GET, PUT | `/admin/storefront-public-metadata` | S,V | settings:read/write | False | True | `apps/web/src/app/api/admin/storefront-public-metadata/route.ts` → `workers/backend/src/storefront-metadata-admin.ts` |
| GET, PUT | `/admin/runtime-settings` | S,V | settings:read/write | False | True | `apps/web/src/app/api/admin/runtime-settings/route.ts` → `workers/backend/src/runtime-settings-admin.ts` |
| GET, POST, PATCH | `/admin/offline-queue` | S,V,L | pos:use | False | True | `apps/web/src/app/api/admin/offline-queue/route.ts` → `workers/backend/src/offline-queue-admin.ts` |
| GET, POST | `/admin/devices` | S,V,L | devices:manage | False | True | `apps/web/src/app/api/admin/devices/route.ts` → `workers/backend/src/devices-admin.ts` |
| PATCH | `/admin/devices/{id}` | V,S | devices:manage | False | True | `apps/web/src/app/api/admin/devices/[id]/route.ts` → `workers/backend/src/devices-admin.ts` |
| POST | `/admin/payments/connect-session` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/payments/connect-session/route.ts` |
| DELETE | `/admin/payments/connections` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/payments/connections/route.ts` |
| GET | `/admin/payments/connections` | S,L | internal-signature | False | False | `apps/web/src/app/api/admin/payments/connections/route.ts` |
| POST | `/admin/payments/connections` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/payments/connections/route.ts` |
| POST | `/admin/payments/connections/reconnect` | V,S | internal-signature | False | True | `apps/web/src/app/api/admin/payments/connections/reconnect/route.ts` |
| POST | `/admin/pin-approval` | OK | pos:use | True | True | `apps/web/src/app/api/admin/pin-approval/route.ts` |
| GET | `/admin/pos/enterprise` | E,L | staff-session | True | False | `apps/web/src/app/api/admin/pos/enterprise/route.ts` |
| POST | `/admin/pos/enterprise` | E | staff-session | True | True | `apps/web/src/app/api/admin/pos/enterprise/route.ts` |
| GET | `/admin/pos/feature-mappings` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/pos/feature-mappings/route.ts` |
| PATCH | `/admin/profile` | V,S,E | settings:write | False | True | `apps/web/src/app/api/admin/profile/route.ts` |
| GET | `/admin/profile/avatar` | S,L | content:read | False | False | `apps/web/src/app/api/admin/profile/avatar/route.ts` |
| GET | `/admin/receipts` | S,L | receipts:read | False | False | `apps/web/src/app/api/admin/receipts/route.ts` |
| POST | `/admin/receipts` | S | receipts:read | False | True | `apps/web/src/app/api/admin/receipts/route.ts` |
| GET | `/admin/reconciliation` | OK | dashboard:read | True | False | `apps/web/src/app/api/admin/reconciliation/route.ts` |
| GET | `/admin/reviews` | L | content:read | False | False | `apps/web/src/app/api/admin/reviews/route.ts` → `workers/backend/src/reviews-admin.ts` |
| PATCH | `/admin/reviews/{id}` | S | content:write | False | True | `apps/web/src/app/api/admin/reviews/[id]/route.ts` |
| GET | `/admin/roles` | L | employees:read | False | False | `apps/web/src/app/api/admin/roles/route.ts` → `workers/backend/src/roles-admin.ts` |
| GET | `/admin/runtime-settings` | L | settings:read | False | False | `apps/web/src/app/api/admin/runtime-settings/route.ts` → `workers/backend/src/runtime-settings-admin.ts` |
| PUT | `/admin/runtime-settings` | V | settings:write | False | True | `apps/web/src/app/api/admin/runtime-settings/route.ts` → `workers/backend/src/runtime-settings-admin.ts` |
| GET | `/admin/offline-queue` | S,L | pos:use | False | False | `apps/web/src/app/api/admin/offline-queue/route.ts` → `workers/backend/src/offline-queue-admin.ts` |
| POST | `/admin/offline-queue` | V,S,L | pos:use | False | True | `apps/web/src/app/api/admin/offline-queue/route.ts` → `workers/backend/src/offline-queue-admin.ts` |
| PATCH | `/admin/offline-queue` | V,S | pos:use | False | True | `apps/web/src/app/api/admin/offline-queue/route.ts` → `workers/backend/src/offline-queue-admin.ts` |
| GET | `/admin/segments` | L | worker-bearer | True | False | `apps/web/src/app/api/admin/segments/route.ts` |
| POST | `/admin/segments` | OK | worker-bearer | True | True | `apps/web/src/app/api/admin/segments/route.ts` |
| GET | `/admin/segments/{id}/members` | L | worker-bearer | True | False | `apps/web/src/app/api/admin/segments/[id]/members/route.ts` |
| POST | `/admin/segments/{id}/members` | OK | worker-bearer | True | True | `apps/web/src/app/api/admin/segments/[id]/members/route.ts` |
| GET | `/admin/shifts` | L | staff-session | True | False | `apps/web/src/app/api/admin/shifts/route.ts` |
| POST | `/admin/shifts` | OK | staff-session | True | True | `apps/web/src/app/api/admin/shifts/route.ts` |
| POST | `/admin/shifts/{id}/close` | E | staff-session | True | True | `apps/web/src/app/api/admin/shifts/[id]/close/route.ts` |
| GET | `/admin/shifts/{id}/reconciliation` | OK | staff-session | True | False | `apps/web/src/app/api/admin/shifts/[id]/reconciliation/route.ts` |
| GET | `/admin/sse` | S,L | dashboard:read | False | False | `apps/web/src/app/api/admin/sse/route.ts` |
| GET | `/admin/storefront-home` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/storefront-home/route.ts` |
| PUT | `/admin/storefront-home` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/storefront-home/route.ts` |
| GET | `/admin/storefront-public-metadata` | S,L | staff-session | False | False | `apps/web/src/app/api/admin/storefront-public-metadata/route.ts` |
| PUT | `/admin/storefront-public-metadata` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/storefront-public-metadata/route.ts` |
| GET | `/admin/tasks/today` | L | dashboard:read | False | False | `apps/web/src/app/api/admin/tasks/today/route.ts` → `workers/backend/src/tasks-admin.ts` |
| POST | `/admin/terminal-open-drawer` | S | staff-session | False | True | `apps/web/src/app/api/admin/terminal-open-drawer/route.ts` |
| POST | `/admin/terminal-print` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/terminal-print/route.ts` |
| POST | `/admin/terminal-print-label` | V,S | staff-session | False | True | `apps/web/src/app/api/admin/terminal-print-label/route.ts` |
| POST | `/admin/tracking-capabilities/revoke` | S | orders:write | False | True | `apps/web/src/app/api/admin/tracking-capabilities/revoke/route.ts` |
| GET | `/admin/voids` | L | staff-session | True | False | `apps/web/src/app/api/admin/voids/route.ts` |
| POST | `/admin/voids` | OK | staff-session | True | True | `apps/web/src/app/api/admin/voids/route.ts` |
| GET | `/admin/workflow/entities` | OK | dashboard:read | True | False | `apps/web/src/app/api/admin/workflow/entities/route.ts` |
| POST | `/admin/workflow/transition` | E | staff-session | True | True | `apps/web/src/app/api/admin/workflow/transition/route.ts` |
| GET | `/auth/callback` | S,L,H | internal-signature | False | False | `apps/web/src/app/api/auth/callback/route.ts` |
| GET | `/auth/session` | S,L | internal-signature | False | False | `apps/web/src/app/api/auth/session/route.ts` |
| POST | `/back-in-stock` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/back-in-stock/route.ts` |
| POST | `/cart/abandonment` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/cart/abandonment/route.ts` **STALE EMBEDDED SOURCE** |
| POST | `/cart/attach-customer` | V,S | internal-signature | False | True | `apps/web/src/app/api/cart/attach-customer/route.ts` |
| POST | `/cart/bind` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/cart/bind/route.ts` |
| GET | `/cart/bind-token` | S,L | internal-signature | False | False | `apps/web/src/app/api/cart/bind-token/route.ts` |
| DELETE | `/cart/line` | S,E | internal-signature | False | True | `apps/web/src/app/api/cart/line/route.ts` |
| PUT | `/cart/line` | S,E | internal-signature | False | True | `apps/web/src/app/api/cart/line/route.ts` |
| POST | `/cart/merge` | V,S,E | internal-signature | False | True | `apps/web/src/app/api/cart/merge/route.ts` |
| POST | `/cart/reconcile` | N,S,E | internal-signature | False | False | `apps/web/src/app/api/cart/reconcile/route.ts` |
| GET | `/cart/resume` | S | internal-signature | False | False | `apps/web/src/app/api/cart/resume/route.ts` |
| GET | `/catalog/product-default-variant` | S | internal-signature | False | False | `apps/web/src/app/api/catalog/product-default-variant/route.ts` **STALE EMBEDDED SOURCE** |
| DELETE | `/checkout/apply-promo` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/checkout/apply-promo/route.ts` |
| POST | `/checkout/apply-promo` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/checkout/apply-promo/route.ts` |
| GET | `/checkout/available-payment-methods` | S | internal-signature | False | False | `apps/web/src/app/api/checkout/available-payment-methods/route.ts` |
| POST | `/checkout/cod-cart-payload` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/checkout/cod-cart-payload/route.ts` **STALE EMBEDDED SOURCE** |
| POST | `/checkout/cod-place-order` | V,N | internal-signature | True | False | `apps/web/src/app/api/checkout/cod-place-order/route.ts` |
| POST | `/checkout/commerce-telemetry` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/checkout/commerce-telemetry/route.ts` **STALE EMBEDDED SOURCE** |
| POST | `/checkout/complete` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/checkout/complete/route.ts` |
| GET | `/checkout/loyalty-balance` | S,E | internal-signature | False | False | `apps/web/src/app/api/checkout/loyalty-balance/route.ts` |
| POST | `/checkout/paypal/confirm` | V,S | internal-signature | False | True | `apps/web/src/app/api/checkout/paypal/confirm/route.ts` |
| POST | `/checkout/preview` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/checkout/preview/route.ts` |
| POST | `/checkout/start` | V,S | internal-signature | False | True | `apps/web/src/app/api/checkout/start/route.ts` |
| POST | `/checkout/upload-payment-receipt` | V,N | internal-signature | True | False | `apps/web/src/app/api/checkout/upload-payment-receipt/route.ts` |
| POST | `/checkout/verify-stock` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/checkout/verify-stock/route.ts` |
| POST | `/cms/announcement/track` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/cms/announcement/track/route.ts` |
| POST | `/cms/experiments/impression` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/cms/experiments/impression/route.ts` |
| GET | `/cms/preview` | OK | internal-signature | True | False | `apps/web/src/app/api/cms/preview/route.ts` |
| GET | `/cron/back-in-stock` | S | internal-signature | False | False | `apps/web/src/app/api/cron/back-in-stock/route.ts` |
| GET | `/cron/campaigns` | OK | internal-signature | True | False | `apps/web/src/app/api/cron/campaigns/route.ts` |
| GET | `/cron/finalize-payment-attempts` | S,L | internal-signature | False | False | `apps/web/src/app/api/cron/finalize-payment-attempts/route.ts` |
| GET | `/cron/inventory-reservations` | S | internal-signature | False | False | `apps/web/src/app/api/cron/inventory-reservations/route.ts` |
| GET | `/cron/payment-reconciliation` | L | internal-signature | True | False | `apps/web/src/app/api/cron/payment-reconciliation/route.ts` |
| GET | `/feature-mappings` | S,L | internal-signature | False | False | `apps/web/src/app/api/feature-mappings/route.ts` |
| POST | `/forms/{formKey}` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/forms/[formKey]/route.ts` |
| GET | `/health` | S,L | internal-signature | False | False | `apps/web/src/app/api/health/route.ts` **STALE EMBEDDED SOURCE** |
| GET | `/health/sop` | S,L | internal-signature | False | False | `apps/web/src/app/api/health/sop/route.ts` **STALE EMBEDDED SOURCE** |
| POST | `/integrations/channels/webhook` | V,N,S,E,H | internal-signature | False | False | `apps/web/src/app/api/integrations/channels/webhook/route.ts` |
| POST | `/integrations/chat-orders/intake` | V,S | chat_orders:manage | False | True | `apps/web/src/app/api/integrations/chat-orders/intake/route.ts` |
| GET | `/integrations/couriers` | S,L | staff-session | False | False | `apps/web/src/app/api/integrations/couriers/route.ts` |
| POST | `/integrations/couriers/telemetry` | S,E | internal-signature | False | True | `apps/web/src/app/api/integrations/couriers/telemetry/route.ts` |
| POST | `/internal/invalidate-commerce-state` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/internal/invalidate-commerce-state/route.ts` |
| POST | `/internal/reconcile-payment-attempt` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/internal/reconcile-payment-attempt/route.ts` |
| POST | `/newsletter` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/newsletter/route.ts` |
| GET | `/newsletter/confirm` | S,L | internal-signature | False | False | `apps/web/src/app/api/newsletter/confirm/route.ts` |
| POST | `/newsletter/unsubscribe` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/newsletter/unsubscribe/route.ts` |
| POST | `/orders/return` | V,S | internal-signature | False | True | `apps/web/src/app/api/orders/return/route.ts` |
| POST | `/payments/checkout-intents` | V,N,E | internal-signature | True | False | `apps/web/src/app/api/payments/checkout-intents/route.ts` |
| GET | `/payments/checkout-intents/{correlationId}` | OK | internal-signature | True | False | `apps/web/src/app/api/payments/checkout-intents/[correlationId]/route.ts` |
| POST | `/payments/checkout-intents/{correlationId}/finalize` | V,N | internal-signature | True | False | `apps/web/src/app/api/payments/checkout-intents/[correlationId]/finalize/route.ts` |
| GET | `/payments/checkout-intents/recover` | S | internal-signature | False | False | `apps/web/src/app/api/payments/checkout-intents/recover/route.ts` |
| POST | `/pos/commerce/commit-sale` | V,S | pos:use | False | True | `apps/web/src/app/api/pos/commerce/commit-sale/route.ts` |
| POST | `/pos/commerce/draft-order` | V,S | pos:use | False | True | `apps/web/src/app/api/pos/commerce/draft-order/route.ts` |
| POST | `/pos/commerce/lookup` | V,N,S | pos:use | False | False | `apps/web/src/app/api/pos/commerce/lookup/route.ts` |
| GET | `/pos/commerce/quick-products` | S | pos:use | False | False | `apps/web/src/app/api/pos/commerce/quick-products/route.ts` |
| GET | `/pos/commerce/search` | S | pos:use | False | False | `apps/web/src/app/api/pos/commerce/search/route.ts` |
| GET | `/pos/commerce/suggestions` | S | pos:use | False | False | `apps/web/src/app/api/pos/commerce/suggestions/route.ts` |
| GET | `/reviews` | S | internal-signature | False | False | `apps/web/src/app/api/reviews/route.ts` |
| POST | `/reviews` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/reviews/route.ts` |
| GET | `/reviews/csrf` | S,L | internal-signature | False | False | `apps/web/src/app/api/reviews/csrf/route.ts` |
| POST | `/reviews/helpful/{id}` | N,S | Supabase bearer + CSRF | False | False | `apps/web/src/app/api/reviews/helpful/[id]/route.ts` → `workers/backend/src/review-mutations.ts` |
| POST | `/reviews/report/{id}` | N,S | Supabase bearer + CSRF | False | False | `apps/web/src/app/api/reviews/report/[id]/route.ts` → `workers/backend/src/review-mutations.ts` |
| GET | `/shop/product` | S | internal-signature | False | False | `apps/web/src/app/api/shop/product/route.ts` |
| GET | `/shop/search-suggest` | S | internal-signature | False | False | `apps/web/src/app/api/shop/search-suggest/route.ts` |
| POST | `/tracking-link` | V,N | internal-signature | True | False | `apps/web/src/app/api/tracking-link/route.ts` |
| POST | `/tracking-link/resolve` | V,N,S | internal-signature | False | False | `apps/web/src/app/api/tracking-link/resolve/route.ts` |
| POST | `/webhooks/nango` | V,N,S,H | internal-signature | False | False | `apps/web/src/app/api/webhooks/nango/route.ts` |
| DELETE | `/wishlist` | S | internal-signature | False | True | `apps/web/src/app/api/wishlist/route.ts` |
| GET | `/wishlist` | S | internal-signature | False | False | `apps/web/src/app/api/wishlist/route.ts` |
| POST | `/wishlist` | S | internal-signature | False | True | `apps/web/src/app/api/wishlist/route.ts` |
| POST | `/wishlist/sync` | S | internal-signature | False | True | `apps/web/src/app/api/wishlist/sync/route.ts` |

### Pancake external-reference operations

This matrix covers all 102 operations in `internal/reference/pancake-open-api.yaml`. These are provider operations, not local Next/Worker routes. Local support is intentionally narrower and is implemented through `apps/web/src/lib/pancake-client.ts`, `apps/web/src/app/api/admin/integrations/pancake/route.ts`, and Worker provider/webhook code.

| Method | External route | Flags | Auth | Scope | Idempotency | Source |
|---|---|---|---|---|---|---|
| GET | `/shops` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/geo/provinces` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/geo/districts` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/geo/communes` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/warehouses` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/warehouses` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/warehouses/{WAREHOUSE_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/inventory_histories` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/orders` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/orders` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/orders/{ORDER_ID}` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/orders/{ORDER_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/orders/{ORDER_ID}/messages` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/order_source` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/orders/tags` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/orders/tags` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/orders/tags/{TAG_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/orders/tag_groups` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/products/get_logistics_shipping_document` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/orders/get_tracking_url` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/orders/{ORDER_ID}/trigger_call` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/orders/arrange_shipment` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/orders/get_promotion_advance_active` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/bank_payments` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/orders_returned` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/orders_returned` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/partners` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/projects` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/list_einvoices/` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/livestream_manager` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/marketplace/get_account_info` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/marketplace/products` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/shopee/evaluate` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/marketplace/reverse_order` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/order_call_laters` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/order_call_laters` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/customers` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/customers` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/customers/{CUSTOMER_ID}` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/customers/{CUSTOMER_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/customers/point_logs` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/promotion_advance/create_multi` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/customers/{CUSTOMER_ID}/load_customer_notes` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/customers/{CUSTOMER_ID}/create_note` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/customer_levels` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/ads_manager/ad_accounts` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/ads_manager/campaigns_v2` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/ads_manager/ad_sets_v2` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/ads_manager/ads_v2` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/debt` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/transactions` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/transactions` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/adv_costs` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/payment_accounts/get_payment_histories` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/products` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/products/{PRODUCT_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/variations/{VARIATION_ID}/update_quantity` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/variations/update_quantity` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/variations/update_composite_product` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/products/variations` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/products/{PRODUCT_SKU}` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/products/update_hide` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/tags_products` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/categories` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/categories` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/brand` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/materials_products` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/product_measurements/get_measure` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/supplier` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/purchases` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/purchases` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/purchases/{PURCHASE_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/purchases/separate` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/export` | X | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/export` | N,X | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/export` | N,X | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/transfers` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/transfers/multi` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/transfers/{TRANSFER_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/transfers/get_status_history/{TRANSFER_ID}` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/stocktakings` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/stocktakings` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/stocktakings/{STOCKTAKING_ID}` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/stocktakings/{STOCKTAKING_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/promotion_advance` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/promotion_advance` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}/promotion_advance/{PROMOTION_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/promotion_advance/delete_multi` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/vouchers` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/vouchers` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/vouchers/{VOUCHER_ID}` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/vouchers/create_multi` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/combo_products` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| POST | `/shops/{SHOP_ID}/combo_products` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/analytics/sale` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/analytics/get_list_formula` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/analytics/get_analytic_fields` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/statistic_custom/folders` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/inventory_analytics/inventory` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/inventory_analytics/inventory_by_product` | OK | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| GET | `/shops/{SHOP_ID}/users` | L | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |
| PUT | `/shops/{SHOP_ID}` | N | ApiKeyAuth | SHOP_ID path scope | not documented | `external Pancake POS reference` |

## Proposed Solutions

### P0 — Replace heuristic OpenAPI generation with executable contracts

1. Define request and response schemas in shared packages using Zod or JSON Schema.
2. Use the exact schema object for runtime parsing and OpenAPI generation.
3. Generate only references and descriptions in the checked-in document; emit `x-source-path` and a SHA-256 fingerprint instead of full handler source.
4. Add examples for success, validation error, unauthorized, forbidden, conflict, rate limit, and provider failure.
5. Validate generated OpenAPI with an OpenAPI parser and JSON Schema validator in CI.
6. Add contract tests that send representative valid/invalid payloads to each route family.
7. Fail CI if any operation has an empty request schema for a mutation, no required fields where the domain requires them, or an undocumented runtime status.

### P0 — Establish one backend authority

1. Build a route ownership manifest: Next BFF, Worker, external provider proxy, or retired.
2. For overlapping domains, make the Next handler a thin authenticated proxy or move the route fully to Worker.
3. Remove direct Supabase access from routes classified as Worker-owned.
4. Keep frontend-only BFF routes only when they provide a deliberate browser/session boundary.
5. Add a CI check that rejects new dual implementations without an ownership entry.

### P0 — Strengthen auth, scope, and mutation proof

1. Require explicit object/organization scope checks for every identifier-bearing route.
2. Replace coarse `x-tenant-scoped` booleans with a machine-readable scope policy: global, organization, user, object-parent, provider-shop.
3. Require idempotency for every side-effecting POST/PATCH/PUT operation unless a documented reason is encoded.
4. Bind idempotency keys to actor, organization, operation, target, and request hash.
5. Add concurrent duplicate tests for payments, inventory, fulfillment, POS, CMS publishing, and provider callbacks.
6. Require audit records for side effects and explicit denial records for rejected operations.

### P1 — Bound every read/export/integration

1. Add maximum page size and default page size to every list route.
2. Prefer cursor pagination for large or changing datasets.
3. Add hard export row/byte/time limits and async export jobs for large data.
4. Add upstream request timeout, response byte limits, retry budgets, and provider-specific error normalization.
5. Add rate limits to sensitive business flows, not only authentication endpoints.

### P1 — Normalize errors

1. Use one RFC 9457 helper for all route failures.
2. Ensure `Content-Type: application/problem+json` is consistent.
3. Keep stable `type`, `code`, `requestId`, and `retryable` fields.
4. Never expose provider response bodies, SQL errors, stack traces, or raw exception messages.
5. Document exact per-route error statuses instead of generic 400/401/500 everywhere.

### P1 — Remove stale and duplicated surfaces

1. Resolved the 13 stale OpenAPI source snapshots by deleting embedded source and regenerating from route source paths/hashes.
2. Partially resolved: deleted the 3 unused files, removed the unused dependency and dead web/SDK exports/types. Remaining monorepo Knip findings require explicit entrypoint/config ownership before deletion; do not delete terminal-agent, demo, script, or CI surfaces based on default discovery alone.
3. Review all legacy references to ports 4000/9000 and retired Medusa route names; keep only explicit test/reference compatibility.
4. Keep generated `.next`, dist, SQLite, and runtime artifacts untracked and outside product evidence.
5. Split `workers/backend/src/router.ts` into bounded route-family routers with a central dispatch table.

### P1 — Make UI truth measurable

1. Resolved: generated and checked a route-state manifest for all 92 pages, with loading and error-boundary coverage verified for every page.
2. For each critical page, test direct load and refresh for ready, loading, empty, unauthorized, forbidden, failure, retry, and mutation success.
3. Add route-specific error boundaries and loading boundaries where async work exists.
4. Mark mock/demo data as simulator-only in both UI and docs.
5. Add authenticated browser proof for admin, checkout, payment, POS, CMS publish, and integration settings.

### P2 — Reduce hygiene noise

1. Triage the 198 remaining source React Doctor warnings by category and ownership; security-sensitive findings must be fixed or explicitly constrained before release.
2. Fix warnings that affect server/client boundaries, effects, render purity, accessibility, and unnecessary rerenders first.
3. Resolved: add a warning budget so new warnings fail CI while legacy warnings remain explicitly tracked; lower the budget whenever a warning class is removed.
4. Keep Knip as a review signal, but distinguish generated/reference/demo files from production files.
5. Measure client bundles and verify server-only SDKs, database clients, secrets, and Worker-only modules never enter browser chunks.

## Product Repositioning

A truthful positioning statement is:

> Universal Music Store is a production-oriented music commerce and operations platform combining a Next.js storefront/admin application with a Cloudflare Worker commerce backend, Supabase PostgreSQL, durable queues, payments, inventory, POS workflows, CMS, and logistics integrations. Its strongest value is deterministic commerce and operational workflow reliability—not AI automation or generated API documentation.

Avoid positioning the OpenAPI generator, demos, or static release checks as a moat. The defensible value is the integrated commerce domain model, operational state, idempotent side effects, staff governance, POS/printer workflow, and provider integrations—provided the backend ownership and contract truth are tightened.

## Final Judgment

- **Truly real:** ecommerce UI, admin UI, checkout/payment/inventory/POS/CMS logic, Worker runtime, queues, Hyperdrive, Supabase persistence, RBAC, idempotency, audit helpers, and provider integrations.
- **Wrapper-like:** broad generated metadata and static documentation claims. Embedded source duplication and heuristic request/response schemas are resolved, but executable authorization/deployed evidence remains open.
- **Real moat today:** integrated music commerce operations and domain workflows, especially POS/offline/terminal, inventory, payments, staff governance, and provider/logistics state.
- **Fake moat:** “strict OpenAPI” based only on generated text, 102 Pancake reference operations presented as local capability, and any unqualified production-proof claim.
- **Fix first:** executable API contracts; one backend ownership model; explicit object/tenant scope; bounded reads/exports; complete error/status contracts; then UI-state evidence and hygiene cleanup.
- **Current honest position:** real and substantial production-oriented software, but not yet contract-complete or evidence-complete enough to claim that every API/UI behavior is fully verified in deployed authenticated conditions.

## Research Basis

- [OpenAPI Specification 3.1.0](https://spec.openapis.org/oas/v3.1.0) — operation objects, request bodies, responses, and security schemes should describe the actual interface consumers can use.
- [OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/) — object/function authorization, unrestricted resource consumption, SSRF, inventory management, and unsafe third-party API consumption are directly relevant to this route surface.
- [RFC 9457 Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) — machine-readable error contracts should describe the HTTP interface and avoid exposing implementation/debug details.
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) — side-effecting retries should bind idempotency keys to the original request and replay the original result safely.

## Implementation evidence addendum (2026-09-20)

This is a historical checkpoint retained for audit traceability. The authoritative
counts and ownership state are in the dated snapshots below; do not use the
historical counts in this section as current release evidence.

Latest generated evidence supersedes the earlier baseline narrative: 15 handlers remain classified as `web-platform-database` (10 admin handlers), the OpenAPI source-drift gate reports 597 matching hashes, and the POS enterprise, storefront-home, and shift lifecycle boundaries are now Worker-owned with bounded projections, durable idempotency, audit logging, and focused tests. The full Worker suite is 320/320 passing.

Implemented and verified in the current checkout:

- CMS media mutations now use the shared durable staff/tenant/idempotency boundary.
- Production admin rate limiting fails closed when Upstash is unavailable; only local development uses the bounded in-process fallback.
- SSE publication evicts controllers that reject writes, and stream cancellation remains idempotent.
- Inventory stream failures return a stable safe error code instead of raw upstream exception text.
- OpenAPI generation emits required fields where route-owned Zod schemas prove them and source SHA-256 fingerprints; the current checked-in reference contains no unresolved response inference markers.
- Seventy-two high-impact mutation/request operations now use shared runtime Zod schemas (including the previously covered commerce/admin mutations plus loyalty, segmentation, employee, operator-note, offline-queue, cart, return, promotion, tracking-link, POS, CMS, privacy-erasure, forms, reviews, tracking-resolution, checkout, telemetry, inventory verification, payment reconciliation, and payment-intent operations); the generated OpenAPI marks those request schemas `x-contract-status: executable` and the handlers import the same objects or the same shared validation object.
- Shared platform-data list helpers now impose database-side row caps on the previously unbounded CMS/admin registries and use a narrow redirect projection; this closes the identified unbounded materialization path while preserving explicit per-route export limits.
- A source-drift gate verifies generated operation/schema fingerprints against the current route tree.
- Shared response parsing now classifies non-2xx status before decoding upstream bodies, while preserving bounded safe error envelopes; the migrated route/client surfaces have regression coverage.
- The admin analytics page now performs one bounded paginated order collection per render instead of three duplicate full-history fetches; the collector has a 10,000-order ceiling and the analytics API returns a normalized `RESOURCE_LIMIT` response when that ceiling is exceeded.
- Admin middleware no longer clones and parses every JSON mutation body before route execution. The shared bounded parser now performs the byte-bounded read, releases stream locks, rejects malformed JSON and prototype-pollution keys, and the lone direct `request.json()` admin route uses the same boundary.
- Remaining web API proxy paths for account, cart, checkout, catalog, admin, integration, and compliance forwarding now use the streaming decoder as well; the reviews route’s standalone text reader is independently byte-bounded for its provider response.
- JSON-LD serialization escapes executable HTML delimiters, CMS HTML sinks use the shared sanitizer, and generated CMS canvas scripts now escape serialized values and insert slot labels as text nodes rather than `innerHTML`.
- Middleware route-family observability is available behind `UVS_ROUTE_METRICS=1`, emitting bounded request-id, status, cache, method, family, and middleware-duration records without enabling production logging by default.
- Deleted-route Next validator artifacts are cleaned before web typecheck.

Current evidence: focused web contract tests and full web tests pass 541/541, Worker tests pass 381/381, workspace typecheck/lint pass, and the contract/security/migration boundary gate passes. The OpenAPI reference contains 276 operations, 318 executable schemas, zero heuristic/unresolved schemas, and 594 matching source hashes; raw CSV exports are represented as binary responses.

The matrix evidence gate now distinguishes terminal external blockers from unresolved local work: 403 rows are inventoried, 355 have explicit blocked classifications with hashed recovery records, 41 are verified with durable evidence, and 7 remain unresolved local findings. This is not a completion claim; the unresolved rows still require implementation and proof.

The static route-state inventory also now covers all 92 UI pages with loading and error boundaries (92/92 each). This closes the missing-boundary inventory finding; runtime state behavior still requires authenticated browser evidence.

## Authoritative implementation snapshot (2026-09-21)

This snapshot is retained as historical evidence. The later “Current authoritative
snapshot” below supersedes its route, hash, and test counts.

This snapshot supersedes earlier counts in this document. The route-ownership manifest contains 205 API route files; 8 remain `web-platform-database` and 3 of those are admin routes. The OpenAPI reference contains 276 operations, the checked admin subset reports 193 matches, and the source-drift gate reports 597 matching operation/schema hashes.

`/admin/payments/{id}/mark-review`, `/admin/payments/{id}/retry`, workflow entity/transition operations, `/admin/voids`, `/admin/reconciliation`, and `/admin/pin-approval` are now Worker-owned. Retry finalization uses the two-database Worker finalization primitive with staff bearer authentication, organization-scoped payment correlation, durable Hyperdrive idempotency, bounded safe errors, and audit logging; it no longer depends on a Next internal secret or direct service-role database access. Focused workflow/payment/void/reconciliation/PIN tests pass; the full Worker suite is being refreshed after this migration.

Current local verification gates pass after regeneration: admin guard, OpenAPI matching/source drift, webhook boundary, route ownership, route-state coverage (92/92 loading and 92/92 error boundaries), storefront client boundary, migration boundary, and audit triage. Workspace typecheck and lint also pass. Provider-backed deployed authentication, safe SQL plans, source-root reconciliation, and long-duration browser memory evidence remain explicit release gates.

The workflow entity list is also Worker-owned with organization-scoped explicit projection, validated pagination/entity filters, and focused tests; `/admin/workflow/transition` remains a separate mutation migration and is still counted among the seven direct admin routes.

## Current authoritative snapshot (2026-09-21, tracking revocation migration)

The generated ownership manifest now reports 205 API route files with zero direct `web-platform-database` storefront routes and no direct admin database route. Cart abandonment, review helpful/report mutations, receipt upload, the CRM bridge, tracking-capability revocation, courier telemetry ingress, terminal drawer execution, customer-account response validation, wishlist response validation, cron responses, checkout-intent recovery, profile updates, COD payload hydration, newsletter responses, checkout mutation responses, limiter fail-closed behavior, and cart/chat/payment-retry/catalog/finalization provider error redaction are Worker-owned or bounded at the Next proxy boundary with their respective signed forwarding, bearer/CSRF, private-storage, replay, signature, device, and timeout controls. OpenAPI remains 276 operations with 193 checked admin matches and 594 matching source hashes. The complete Worker suite passes 381/381 and the full web suite passes 541/541; Worker typecheck, workspace typecheck/lint, and all contract boundary gates pass. Deployed authenticated/provider-backed evidence, source-root reconciliation, and long-duration memory soak remain open release gates.

Vercel deployment availability is separately verified: the connected `universalmusic` Next.js project has READY `dev` preview commit `c97937c` and READY `main` production commit `81aada3`, both from `JustineDevs/UMS`. This does not prove that the current dirty checkout is the source for either deployment.
