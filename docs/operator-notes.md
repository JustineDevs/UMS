# Operator notes: memory and production hardening

## Safe local development

Use the bounded launcher already configured by the repository:

```bash
pnpm cleanup:dev
pnpm dev
```

The web child receives `--max-old-space-size=1536`; the local Worker receives 768 MB. For attribution, run a bounded probe instead:

```bash
UVS_MEMORY_PROBE_DURATION_MS=900000 \
UVS_MEMORY_PROBE_INTERVAL_MS=5000 \
pnpm diagnose:dev-memory
```

The probe emits JSONL samples with the process tree, aggregate RSS, data-segment proxy, and HMR/full-reload/error counters. It forwards child output and stops the process group at the duration limit. It is a local development tool only; it is not imported by Next, the Worker, or Vercel functions.

Port/process hygiene note: the preserved listener on port 3002 is not this workspace. Its process cwd is `/home/justine/Downloads/MyWebsite/Portfolio V2`, its child reports Next 14.2.35, and a request serves the JustineDevs Portfolio application. Do not use port 3002 as UVS storefront evidence. Start this workspace on an explicitly selected free port and verify the process cwd before attributing memory, routes, or HMR behavior to UVS. It was not terminated during this audit because the session requested preservation of running frontend/backend processes.

For an in-process snapshot, start the web app with `UVS_DEV_DIAGNOSTICS=1` and `STOREFRONT_INTERNAL_DIAGNOSTICS_SECRET=<local-secret>`, then request `/api/internal/dev-diagnostics` with `x-internal-secret: <local-secret>`. It returns bounded Node RSS/heap/external memory, a short event-loop-delay sample, and active SSE-client count. The route returns 404 in production, without the explicit flag, or without the secret; it is not a production observability endpoint.

The controlled 15-minute idle probe on 2026-09-20 completed normally after 900,012 ms with 90 samples. Peak aggregate process-tree RSS was 1325.3 MiB; Next stabilized near 214 MiB, with zero Fast Refresh, full-reload, or error counters, and no kernel OOM/killed-process record during the run. This proves bounded idle/startup behavior only; it is not a substitute for repeated interactive CMS edits.

The probe now has a fail-safe aggregate RSS limit: `UVS_MEMORY_PROBE_MAX_TOTAL_RSS_MIB` defaults to 6000 MiB and terminates the supervised process tree with `rss-threshold` before the host approaches the observed ~6.8 GiB crash path. A Webpack CMS browser soak on 2026-09-20 was intentionally stopped at 6835.6 MiB after cold compilation; `next-server` was 4351.9 MiB and browser workers were the next-largest consumers. It produced no HMR/full-reload/error signal, so the remaining problem is cold development compilation/process pressure, not a proven editor-loop leak. A fresh 60,007 ms isolated Turbopack run on port 3107 peaked at 559.6 MiB, with zero Fast Refresh/full-reload/error events and clean supervised shutdown.

A fresh 60-second bounded Next-launcher probe on 2026-09-21 completed normally with a 3-process tree, zero HMR/full-reload/error events, and a 564.8 MiB aggregate RSS peak. The Next child stabilized around 399–445 MiB during idle startup and the probe terminated the process group cleanly at the duration limit. This is startup/idle evidence only; it does not satisfy the still-open interactive CMS-edit soak.

Development now defaults to Turbopack through `UVS_DEV_NEXT_BUNDLER=turbo`; `UVS_DEV_NEXT_BUNDLER=webpack pnpm dev` is the compatibility fallback. The former Turbopack blockers were repaired: the human sitemap page is `/site-map`, `/sitemap.xml` is the machine sitemap, generated CSS uses syntax supported by both bundlers, and instrumentation has no direct Edge-visible Node APIs. The complete canonical CMS file passes 5/5 under Turbopack. A repeated 10-test run reached 5485 MiB and was stopped by a test-state assertion after 4 tests passed; this is lower than the 6835.6 MiB Webpack run but is not evidence of a leak-free long soak. Keep the bounded probe enabled and do not raise the heap cap to mask cold-compile pressure.

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
- Production traffic metrics and safe SQL EXPLAIN evidence are not available in this checkout.
- Full provider-backed commerce/security/E2E verification remains environment-dependent; the canonical local CMS flow is green under the default Turbopack launcher, while repeated stateful CMS soak remains an open measurement.

## Current verification snapshot (2026-09-20)

- `pnpm typecheck`: passed for web, Worker, SDK, and mail packages.
- `pnpm --filter web test`: 539 passed, 0 failed.
- Fresh web regression run after the latest response-contract, device, and JSON-LD hardening: 539 passed, 0 failed.
- `pnpm test:backend:worker:all`: 260 passed, 0 failed.
- `pnpm --filter web lint`: passed.
- `pnpm check:admin-openapi`: 276 generated operations; the checked admin subset reports 193 matches.
- `pnpm run check:admin-openapi-source`: 594 operation/schema source hashes match the current route tree.
- `pnpm check:audit-triage`: passed with no vulnerabilities.
- `pnpm build`: passed; webpack still reports 113 KiB and 267 KiB CMS strings in its persistent cache, so the visual-builder bundle remains an optimization target rather than a zero-warning result.
- `pnpm check:route-state`: passed; all 92 App Router pages have a generated static inventory for loading, empty, blocked, unauthorized, failure, retry, and success signals, plus loading/error boundaries (92/92 each). This is static source evidence and still requires authenticated browser state verification.
- Worker migration coverage: 314 Worker tests passed, including authenticated and bounded Worker-owned admin/storefront reads plus bounded Resend transport coverage.
- Route ownership inventory: 205 API route files; 19 `web-platform-database` routes remain migration work, including 14 admin routes, while API_URL-backed Worker proxies are classified separately.
- Worker SQL bounds: public blog 100, category content 500, sitemap 5,000, regions 100, collection products 500, receipt items 500, and staff grants 100; shared admin/customer offsets clamp at 100,000. Workers accept only role-specific `APP_HYPERDRIVE`/`MEDUSA_HYPERDRIVE` bindings or their corresponding local database URLs; a generic `HYPERDRIVE` alias is not supported.
- Long memory evidence: bounded idle probe completed at 15 minutes, 1,325.3 MiB peak aggregate RSS, zero runtime error/reload counters, and no OOM record during the measured window.
- Turbopack CMS evidence: canonical authenticated flow passed 5/5; bounded repeated run peaked at 5,485 MiB and stopped at child exit after 4/10 tests passed and 2 state assertions failed, with the RSS guard below its 6,000 MiB ceiling.
- Campaign execution reads segment members, consent, and sent-recipient state in deterministic 500-row pages instead of loading whole tables into one Worker/job isolate.
- Critical provider/catalog failure responses use stable safe codes (`POS_*`, `PAYPAL_CONFIRMATION_FAILED`, `CHECKOUT_PROVIDER_FAILED`, `PROVIDER_*`, `CATALOG_UNAVAILABLE`) rather than raw exception messages.

The OpenAPI generator records source hashes. The current reference contains 318 executable schema entries and zero heuristic or unresolved markers. Every operation discloses that permission, tenant-scope, and replay metadata is source-inferred until executable route metadata tests exist; keep generated OpenAPI and runtime contracts synchronized in every route change.

The current working tree is still a dirty migration with deleted legacy route files and untracked replacement Worker/web files. Generated Next type output is cleaned before web typecheck so stale deleted-route validators cannot contaminate the result, but source-of-truth reconciliation remains an external release gate.

## Latest local evidence (2026-09-21)

Route ownership is 205 files with zero direct `web-platform-database` routes and no direct admin database route; OpenAPI is 276 operations with 193 checked admin matches and 594 source hashes; focused cart/review/receipt/CRM bridge/PIN/reconciliation tests and all contract boundary gates pass. Payment mark-review/retry, workflow entity/transition operations, voids, reconciliation, PIN approval, cart abandonment, review mutations, receipt upload, and the CRM bridge execute through the Worker with durable boundaries and tenant scope. This does not prove deployed provider-backed or long-duration browser behavior.

Current authoritative evidence after the cart abandonment, review mutation, receipt upload, CRM bridge, tracking-capability revocation, courier telemetry, terminal drawer, customer-account response, wishlist, cron, checkout-intent, profile, COD, newsletter, checkout mutation, rate-limit, and cart/chat error-redaction hardening migrations: 205 route files, zero direct `web-platform-database` routes, no direct admin database route, 276 OpenAPI operations, 193 checked admin matches, 594 source hashes, 381/381 Worker tests, and 541/541 web tests. Workspace typecheck/lint and all contract gates pass. These migrated paths are Worker-owned or bounded at the Next proxy boundary with security and idempotency controls. Do not treat this as deployed/provider-backed proof; long-duration memory soak remains open.

The payment-recovery cron route authenticates before creating its service client or querying storage. This preserves the 401 contract when secrets or database configuration are absent; the live production 503 remains deployment/configuration drift until the corrected route is promoted and verified.

The corrected UVS runtime was independently launched from `apps/web` on isolated port 3011 with Next 15.5.24/Turbopack: cron without a secret returned 401 and health returned 200. The temporary runtime was stopped after verification. Port 3002 remains excluded from UVS evidence because it serves the unrelated Portfolio V2 process.

Error pages are intentionally outside the public CMS-backed layout. This prevents an external CMS/database read from blocking static error-page generation. The bounded production build now generates all 170 pages, including `/errors/429`, without the prior three-attempt timeout.

Webpack may report 113 KiB and 267 KiB serialized strings from generated visual-builder capture data. Those registries are editor-only and dynamically loaded; the build keeps the CMS builder out of shared chunks. Treat the warning as cache-build overhead, not proof of a storefront memory leak, and remeasure bundle composition before changing generated provenance data.

The latest bounded web TypeScript diagnostic completed in 2.41 seconds over 2,873 files and used 517,732 KiB of compiler memory. This is a one-shot measurement, not a watch-mode or host-OOM claim; repeat it after any tsconfig or dependency-graph change.

The dev config now declares the Turbopack alias section explicitly, eliminating the Next warning about webpack-only configuration on the Turbopack launcher. Package-specific pnpm-store aliases remain webpack-only because Next 15 Turbopack treated those absolute targets as relative server imports; the isolated 60-second probe starts cleanly with no module-resolution errors.

Vercel connector evidence confirms the `universalmusic` Next.js project has READY `dev` preview deployment `c97937c` and READY `main` production deployment `81aada3` from `JustineDevs/UMS`. Local source-to-deployment reconciliation remains open because this checkout is dirty and must be mapped non-destructively before local files are presented as deployed proof.
