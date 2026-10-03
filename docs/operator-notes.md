# Operator notes: memory and production hardening

## Current production checkpoint — 2026-10-01

Worker production version `8f8f346a-1f10-4d20-b0d4-3c986751d732` is deployed and `/readyz` reports both database roles ready. The public Vercel health contract passes. The organization runtime setting previously allowed only `COD`; use the audited `/api/admin/runtime-settings` route for provider changes. On 2026-09-29 the full settings payload was preserved and `XENDIT` was added. Current live methods are `XENDIT` and `COD`. The latest hosted Xendit run passed failed/expired return checks 2/2, while the hosted-success card-field flow failed before payment completion; do not treat the earlier success claim as current evidence. Do not enable Stripe or PayPal solely because secret names exist: validate each credential and provider flow first.

## Fresh verification snapshot — 2026-10-02

The latest local generation produced 280 OpenAPI operations, 323 executable
schemas, 0 heuristic schemas, 0 unresolved schemas, and 603 matching
source hashes. The checked admin subset reports 196 route operations. This
supersedes the older numeric snapshots below.

The checked-in OpenAPI reference is generated from the current route tree. The
current contract reports 280 total operations, 323 executable schemas, 0
unresolved schemas, and 603 matching source hashes; the checked admin
subset reports 196 route operations. Run `pnpm quality:contracts` after any
route change; do not hand-edit the generated YAML or PDF.

Current local static gates pass. Knip is clean under `knip.json`. React Doctor
reports 102 source warnings with 0 errors; generated `.next-dev` source maps are
excluded and the configured warning budget is 102.

The matrix evidence verifier is structurally complete but intentionally not
release-green: 403 rows are inventoried, 59 are marked verified, 344 are
explicitly blocked, and all 403 rows have evidence records with zero
unresolved rows and zero verifier errors. Formerly passing stale records were
demoted to blocked status with recovery conditions.
Fresh hosted storefront UX (25/25), API-security (9/9), and local authenticated
account/logout/wishlist (3/3) evidence was regenerated on 2026-10-01. The
blocked/stale rows are not completion evidence; they represent provider, deployed,
or other external
conditions that still require their stated recovery runs. Do not repair
evidence by touching timestamps or hashes; rerun the affected scenarios and
write evidence only from real verification.

The visual CMS editor now sanitizes `innerHTML`, `href`, and `src` property edits
before invoking component lifecycle handlers or serializing the live canvas.
This keeps preview behavior aligned with published CMS output and rejects
script/event-handler and executable URL payloads without weakening the existing
rich-text allowlist. Verified with `cms-page-builder-preview.test.ts` (4/4),
web typecheck/lint, contract checks, and the Worker suite (519/519).

## Safe local development

Use the bounded launcher already configured by the repository:

```bash
pnpm cleanup:dev
pnpm dev
```

The bounded launcher owns one local stack at a time: the storefront listens on
`127.0.0.1:3000` and the Wrangler Worker listens on `127.0.0.1:8787`.
`pnpm cleanup:dev` is the supported way to clear a stale stack before
restarting it. Ports `3008` and `3009` are not UVS development ports, and the
Worker inspector is disabled by default; `9229` must remain free unless an
operator explicitly starts a separate debugging session.

The launcher passes the bind addresses explicitly rather than relying on
framework defaults. This keeps the local commerce and admin surfaces off the
LAN and prevents a second UVS checkout or ad-hoc Next process from being
mistaken for the verified storefront.

The web child receives `--max-old-space-size=1536`; the local Worker receives 768 MB. For attribution, run a bounded probe instead:

```bash
UVS_MEMORY_PROBE_DURATION_MS=900000 \
UVS_MEMORY_PROBE_INTERVAL_MS=5000 \
pnpm diagnose:dev-memory
```

The probe emits JSONL samples with the process tree, aggregate RSS, data-segment proxy, and HMR/full-reload/error counters. It forwards child output and stops the process group at the duration limit. It is a local development tool only; it is not imported by Next, the Worker, or Vercel functions.

Port/process hygiene note: the preserved listener on port 3002 is not this workspace. Its process cwd is `/home/justine/Downloads/MyWebsite/Portfolio V2`, its child reports Next 14.2.35, and a request serves the JustineDevs Portfolio application. Do not use port 3002 as UVS storefront evidence. Start this workspace on an explicitly selected free port and verify the process cwd before attributing memory, routes, or HMR behavior to UVS. It was not terminated during this audit because the session requested preservation of running frontend/backend processes.

For an in-process snapshot, start the web app with `UVS_DEV_DIAGNOSTICS=1` and `STOREFRONT_INTERNAL_DIAGNOSTICS_SECRET=<local-secret>`, then request `/api/internal/dev-diagnostics` with `x-internal-secret: <local-secret>`. It returns bounded Node RSS/heap/external memory, a short event-loop-delay sample, and active SSE-client count. The route returns 404 in production, without the explicit flag, or without the secret; it is not a production observability endpoint.

The latest persisted direct-process 15-minute idle probe completed normally after 900,008 ms with 180 samples. Peak aggregate process-tree RSS was 1,600.1 MiB across the Next/Worker/esbuild/workerd stack, with zero Fast Refresh, full-reload, or error counters. This proves bounded idle/startup behavior only; it is not a substitute for repeated interactive CMS edits.

The probe now has a fail-safe aggregate RSS limit: `UVS_MEMORY_PROBE_MAX_TOTAL_RSS_MIB` defaults to 6000 MiB and terminates the supervised process tree with `rss-threshold` before the host approaches the observed ~6.8 GiB crash path. A Webpack CMS browser soak on 2026-09-20 was intentionally stopped at 6835.6 MiB after cold compilation; `next-server` was 4351.9 MiB and browser workers were the next-largest consumers. It produced no HMR/full-reload/error signal, so the remaining problem is cold development compilation/process pressure, not a proven editor-loop leak. The scope-aware probe now includes transient systemd development scopes; its 60,009 ms run peaked at 1526.8 MiB across Next/Worker/esbuild/workerd, with zero Fast Refresh/full-reload/error events and clean supervised shutdown. The latest persisted direct-process run completed the full 900,008 ms duration at 1,600.1 MiB peak with zero refresh/reload/error events. This closes the idle-process duration gap; an interactive CMS memory soak remains unverified.

Evidence freshness note: no passing record is stale according to the matrix verifier. Fresh hosted storefront UX (25/25), API-security (9/9), local unit/static, cart, and authenticated account/logout/wishlist records were regenerated on 2026-10-01. Stripe, Xendit hosted-success, COD, and deployed About records remain explicitly blocked because their current recovery runs did not produce valid fresh proof; do not treat those blockers as provider or production evidence.

A fresh 60-second bounded Next-launcher probe on 2026-09-21 completed normally with a 3-process tree, zero HMR/full-reload/error events, and a 564.8 MiB aggregate RSS peak. The Next child stabilized around 399–445 MiB during idle startup and the probe terminated the process group cleanly at the duration limit. This is startup/idle evidence only; it does not satisfy the still-open interactive CMS-edit soak.

Development now defaults to Turbopack through `UVS_DEV_NEXT_BUNDLER=turbo`; `UVS_DEV_NEXT_BUNDLER=webpack pnpm dev` is the compatibility fallback. The former Turbopack blockers were repaired: the human sitemap page is `/site-map`, `/sitemap.xml` is the machine sitemap, generated CSS uses syntax supported by both bundlers, and instrumentation has no direct Edge-visible Node APIs. The complete canonical CMS file passes 5/5 under Turbopack, and the focused stateful editor flow passed 10/10 repetitions over 4.3 minutes. The earlier 30-repeat/15.3-minute dev-mode run reached 27/30 before Fast Refresh transport/reload failures and fixture cleanup drift. After bounded Worker mutation timeouts, transient-request retry, exact CMS-page snapshot/restore, and a 200-node-cap fixture guard, the same production-mode Worker-backed flow passes 15/15 repetitions in 5.0 minutes. This proves repeated authenticated editor mutation/restore for this flow, not a leak-free telemetry-backed 15-minute memory soak. Keep the bounded probe enabled and do not raise the heap cap to mask cold-compile pressure.

The CMS browser flow now launches and reaches the real builder after installing the pinned Playwright Chromium runtime. The E2E heap-budget override and localhost/127.0.0.1 CSP preview-origin mismatch are fixed; the complete canonical CMS file passes 5/5, covering preview selection, inspector geometry, slot mutation/drag-drop, undo/redo, persisted save/reload, page publish/mutation preservation, global header editing, and live builder tabs. No interactive CMS memory soak is claimed yet.

Stop the run immediately if aggregate RSS approaches available host memory, swap begins growing rapidly, or the kernel reports an OOM precursor. Do not collect heap snapshots during host pressure. After a crash, preserve:

```bash
journalctl -k -b --no-pager | rg -i 'oom|out of memory|killed process|next-server'
```

For the CMS reproduction, record one baseline sample, edit the same draft repeatedly for up to 15 minutes, then compare the web/Worker process rows with browser renderer memory. Do not run build, typecheck, E2E, and dev watch processes concurrently.

## Verification order

```bash
pnpm --filter @universal-music-store/web exec tsx --test \
  src/lib/auth-cache.test.ts \
  src/lib/admin-sse-hub.test.ts \
  src/lib/admin-rate-limit.test.ts \
  src/app/api/admin/inventory/stream/route.test.ts \
  src/components/cms/cms-page-builder-preview.test.ts

pnpm --filter @universal-music-store/web exec eslint src/lib/auth.ts \
  src/lib/admin-sse-hub.ts src/app/api/admin/sse/route.ts \
  src/app/api/admin/inventory/stream/route.ts src/lib/admin-rate-limit.ts \
  src/components/cms/CmsPageBuilder.tsx

NODE_OPTIONS=--max-old-space-size=1536 \
  pnpm --filter @universal-music-store/web exec tsc --noEmit --pretty false -p tsconfig.json
```

Run the Worker test/typecheck and full release gates sequentially after the current dirty migration has a tracked source of truth. Provider-backed checks must use documented credentials and must not be simulated with empty secrets.

## Deployment/source-of-truth rule

The live Vercel project is `universalmusic` and currently reports historical root `apps/storefront`; the current local migration uses `apps/web`. Do not change Vercel Root Directory, deploy, or promote `dev` until the deployed commit and local migration relationship are confirmed through normal branch/PR workflow.

Production health checks currently used:

```bash
curl -fsSIL https://universalmusic.vercel.app/
curl -fsS https://universalmusic.vercel.app/api/health
```

On 2026-09-21, the unauthenticated production API health suite ran against the live Vercel URL with 43 cases: 10 passed, 17 failed, and 16 were skipped because provider/admin credentials were unavailable. The failed admin-negative cases received 404; `/api/admin/inventory` returned `x-matched-path: /404` and `x-next-error-status: 404`, proving the deployed app is not exposing the current admin route tree. The cron secret-negative case received 503 (`Payment recovery is temporarily unavailable`) instead of the expected 401. Treat this as deployment/source-root and runtime-configuration drift. Do not weaken the local 401/403 contract or treat public health 200 as proof that the current dirty checkout is deployed.

## SQL and data safety

There are exactly two database ownership boundaries: `MEDUSA_DB_URL` for commerce and `APP_DB_URL` for platform/CMS/RBAC/audit data. Run `EXPLAIN (ANALYZE, BUFFERS)` only against a safe representative environment. Do not add an index or rewrite a transaction based on static grep alone, and do not run mutating diagnostics against production.

## Rollback

All changes in this pass are local working-tree changes. Revert only the specific hardening files through the normal review workflow after identifying the regression; do not use `git reset --hard`, broad checkout, or recursive deletion because this workspace contains unrelated migration work. If the dev probe itself causes overhead, stop the wrapper; it has no application-side state.

## Known release blockers

- Current migration tree is heavily dirty/untracked with deleted legacy app trees.
- Vercel source mapping is unresolved despite the live deployment being healthy.
- Production traffic/cardinality mapping is unavailable; safe read-only SQL EXPLAIN evidence is now recorded for both configured databases.
- Full provider-backed commerce/security/E2E verification remains environment-dependent; the canonical CMS flow and a 15/15 production-mode repeated editor flow are green, while telemetry-backed memory soak remains an open measurement.

## Current verification snapshot (2026-09-20; historical)

- `pnpm typecheck`: passed for web, Worker, SDK, and mail packages.
- `pnpm --filter web test`: 539 passed, 0 failed.
- Fresh web regression run after the latest response-contract, device, and JSON-LD hardening: 539 passed, 0 failed.
- `pnpm test:backend:worker:all`: 260 passed, 0 failed.
- `pnpm --filter web lint`: passed.
- `pnpm check:admin-openapi`: 280 generated operations; the checked admin subset reports 196 matches.
- `pnpm run check:admin-openapi-source`: 603 operation/schema source hashes match the current route tree.
- `pnpm check:audit-triage`: passed with no vulnerabilities.
- `pnpm build`: passed; webpack still reports 113 KiB and 267 KiB CMS strings in its persistent cache, so the visual-builder bundle remains an optimization target rather than a zero-warning result.
- `pnpm check:route-state`: passed; all 92 App Router pages have a generated static inventory for loading, empty, blocked, unauthorized, failure, retry, and success signals, plus loading/error boundaries (92/92 each). This is static source evidence and still requires authenticated browser state verification.
- Worker migration coverage: 314 Worker tests passed, including authenticated and bounded Worker-owned admin/storefront reads plus bounded Resend transport coverage.
- Historical route ownership inventory (2026-09-20): 205 API route files; 19 `web-platform-database` routes remained migration work, including 14 admin routes. Current generated ownership is verified separately by `pnpm check:route-ownership` and must be used for present-day counts.
- Worker SQL bounds: public blog 100, category content 500, sitemap 5,000, regions 100, collection products 500, receipt items 500, and staff grants 100; shared admin/customer offsets clamp at 100,000. Workers accept only role-specific `APP_HYPERDRIVE`/`MEDUSA_HYPERDRIVE` bindings or their corresponding local database URLs; a generic `HYPERDRIVE` alias is not supported.
- Long memory evidence: bounded idle probe completed at 15 minutes, 1,325.3 MiB peak aggregate RSS, zero runtime error/reload counters, and no OOM record during the measured window.
- Turbopack CMS evidence: canonical authenticated flow passed 5/5; the focused repeated editor flow passed 10/10 over 4.3 minutes. The successful repetition run did not collect process-RSS telemetry, so the 6,000 MiB guard was not used as a memory conclusion.
- Campaign execution reads segment members, consent, and sent-recipient state in deterministic 500-row pages instead of loading whole tables into one Worker/job isolate.
- Critical provider/catalog failure responses use stable safe codes (`POS_*`, `PAYPAL_CONFIRMATION_FAILED`, `CHECKOUT_PROVIDER_FAILED`, `PROVIDER_*`, `CATALOG_UNAVAILABLE`) rather than raw exception messages.

The OpenAPI generator records source hashes. The current reference contains 323 executable schema entries, zero heuristic entries, and 0 unresolved entries. Every operation discloses that permission, tenant-scope, and replay metadata is source-inferred until executable route metadata tests exist; keep generated OpenAPI and runtime contracts synchronized in every route change.

The current working tree is still a dirty migration with deleted legacy route files and untracked replacement Worker/web files. Generated Next type output is cleaned before web typecheck so stale deleted-route validators cannot contaminate the result, but source-of-truth reconciliation remains an external release gate.

## Latest local evidence (2026-09-21)

Historical snapshot (2026-09-21; superseded by the 2026-09-27 snapshot above): route ownership was 205 files, OpenAPI was 276 operations with 193 checked admin matches and 594 source hashes. It does not represent the current contract.

Historical snapshot (2026-09-21; superseded): the earlier migration evidence reported 276 OpenAPI operations, 193 checked admin matches, and 594 source hashes. Use the current authoritative snapshot at the top of this document for present-day counts and verification status.

The payment-recovery cron route authenticates before creating its service client or querying storage. This preserves the 401 contract when secrets or database configuration are absent; the live production 503 remains deployment/configuration drift until the corrected route is promoted and verified.

The corrected UVS runtime was independently launched from `apps/web` on isolated port 3011 with Next 15.5.24/Turbopack: cron without a secret returned 401 and health returned 200. The temporary runtime was stopped after verification. Port 3002 remains excluded from UVS evidence because it serves the unrelated Portfolio V2 process.

Error pages are intentionally outside the public CMS-backed layout. This prevents an external CMS/database read from blocking static error-page generation. The bounded production build now generates all 170 pages, including `/errors/429`, without the prior three-attempt timeout.

Webpack may report 113 KiB and 267 KiB serialized strings from generated visual-builder capture data. Those registries are editor-only and dynamically loaded; the build keeps the CMS builder out of shared chunks. Treat the warning as cache-build overhead, not proof of a storefront memory leak, and remeasure bundle composition before changing generated provenance data.

The latest bounded web TypeScript diagnostic completed in 2.41 seconds over 2,873 files and used 517,732 KiB of compiler memory. This is a one-shot measurement, not a watch-mode or host-OOM claim; repeat it after any tsconfig or dependency-graph change.

The dev config now declares the Turbopack alias section explicitly, eliminating the Next warning about webpack-only configuration on the Turbopack launcher. Package-specific pnpm-store aliases remain webpack-only because Next 15 Turbopack treated those absolute targets as relative server imports; the isolated 60-second probe starts cleanly with no module-resolution errors.

Vercel connector evidence confirms the `universalmusic` Next.js project has READY `dev` preview deployment `c97937c` and READY `main` production deployment `81aada3` from `JustineDevs/UMS`. Local source-to-deployment reconciliation remains open because this checkout is dirty and must be mapped non-destructively before local files are presented as deployed proof.
