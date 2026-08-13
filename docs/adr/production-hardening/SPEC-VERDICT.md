# SPEC verdict — production hardening checklist (1–26)

**Revision 2:** A follow-up source review found many earlier `TODO` counts were **false positives** (HTML `placeholder` attributes, adapter strings like `"mock"`). Several Tier 1–2 surfaces are **wired in source**; remaining risk is **test and ops proof**, not missing components. See [CORRECTED-AUDIT-AND-OSS-GAPS.md](./CORRECTED-AUDIT-AND-OSS-GAPS.md).

Evidence date: repository scan on the active workspace. Verdicts use **current code + cited files**. **Strict IMPLEMENTED** still requires **automated validation** where the spec demands it; many items stay **NOT DONE** until E2E or contract tests exist even if UI is complete.

---

## ProductEditorForm catalog editor completeness

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** `apps/admin/src/components/catalog/ProductEditorForm.tsx` implements create and edit flows calling `/api/admin/catalog/products` with variant matrix, stock payload, mutation classification toasts, and related catalog UX (per source trace).

**Missing For Completion:** Automated admin E2E or integration tests proving full catalog CRUD in CI. Prior checklist claim of 24 code `TODO`s is **not supported** by literal `TODO` comments in the current file.

**Validation:** unit tests: not verified. integration tests: NOT DONE for catalog save paths. e2e/runtime test: NOT DONE for catalog editor. manual verification: can confirm happy path.

**Migrations:** none

**Env / Config:** none identified

**Rollback:** n/a

---

## Terminal agent HTTP bridge and adapters

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** `apps/terminal-agent/src/server.ts` implements mutating routes including `/print-receipt`, `/print-label`, `/open-drawer`, `/cloudprnt`, `/status`, `/devices`, adapter matrix (mock with production guard, TCP, relays, QZ, Star CloudPRNT), and heartbeat behavior (per source trace).

**Missing For Completion:** CI or release-gate proof against a pinned device profile; runbook sign-off for production adapter choice. Prior `TODO` count claim is **not supported** by literal `TODO` comments.

**Validation:** unit tests: not verified. integration tests: not verified. e2e/runtime test: NOT DONE for hardware or approved mock-in-CI. manual verification: required for each store deployment.

**Migrations:** none

**Env / Config:** `TERMINAL_AGENT_PORT`, `TERMINAL_DEVICE_NAME`, adapter-specific vars per `device-profile.ts`

**Rollback:** n/a

---

## Admin POS page UI wiring

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none in this pass)

**Behavior Implemented:** `apps/admin/src/app/(dashboard)/admin/pos/page.tsx` wires `handleCommitSale` to Medusa `commit-sale`, offline queue, receipt print helper, shift fetch, void modal, and related POS UX (per source trace).

**Missing For Completion:** Playwright or scripted POS journey in CI; load test for offline sync. Prior `TODO` count claim is **not supported** by literal `TODO` comments.

**Validation:** e2e/runtime: NOT DONE for full POS journey. manual: required for store pilot.

**Migrations:** none

**Env / Config:** admin + Medusa + optional terminal agent URLs

**Rollback:** n/a

---

## compliance.ts anonymizeStaleOrderAddresses

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** `anonymizeStaleOrderAddresses`, `exportDataSubjectByEmail` in `packages/platform-data/src/compliance.ts`

**Behavior Implemented:** `anonymizeStaleOrderAddresses` returns `{ addressesUpdated: 0 }` and ignores inputs (no-op stub). `exportDataSubjectByEmail` returns **empty** `orders`, `addresses`, `orderItems`, `payments` arrays (Supabase `users` row only).

**Missing For Completion:** Real anonymization for Supabase-owned PII tables; DSAR must aggregate **Medusa** commerce data via Admin API where applicable; audit logging; idempotent batching.

**Validation:** unit tests: NOT DONE. integration: NOT DONE.

**Migrations:** possible new columns or job markers if required by legal process

**Env / Config:** Supabase service role for batch jobs only; Medusa admin credentials for DSAR pull

**Rollback:** revert migration and job schedule

---

## Payment recovery cron and recovery secrets

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Behavior Implemented:** `apps/storefront/src/app/api/cron/finalize-payment-attempts/route.ts` implements secret check and finalize delegation. `render.yaml` includes cron curl example. Root and `apps/storefront/vercel.json` have **no** `crons` block for Vercel-native scheduling.

**Missing For Completion:** Vercel Cron (or equivalent) wired to storefront URL with `STOREFRONT_PAYMENT_CRON_SECRET`. Runbook step that treats this as **mandatory** for production, not optional.

**Validation:** integration test or staging cron dry-run. manual: invoke route with bearer secret.

**Migrations:** none

**Env / Config:** `STOREFRONT_PAYMENT_CRON_SECRET`, `STOREFRONT_INTERNAL_RECONCILE_SECRET`, `STOREFRONT_ORIGIN`

**Rollback:** disable cron job in host UI

---

## FulfillmentPanel admin workflow

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none)

**Behavior Implemented:** `apps/admin/src/components/FulfillmentPanel.tsx` posts shipments to `/api/medusa/shipments` and PATCHes order status via `/api/medusa/orders/:id` (per source trace).

**Missing For Completion:** Automated test proving partial line fulfillment and shipment tracking registration if those code paths are required for your process; confirm against `docs/partial-fulfillment.md` for subset fulfillments.

**Validation:** admin E2E: NOT DONE. manual order fulfillment path: required.

**Migrations:** none

**Env / Config:** Medusa admin credentials and tracking provider keys if used

**Rollback:** n/a

---

## checkout-client payment path stubs

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none)

**Behavior Implemented:** `apps/storefront/src/app/(public)/checkout/checkout-client.tsx` implements profile gates, Medusa totals panel, embedded PSP UI, and pay flow orchestration (no literal `TODO` markers found in prior grep).

**Missing For Completion:** Full PSP matrix in CI (item 25); security review of payment state transitions.

**Validation:** existing critical E2E partial coverage; extend as in item 25.

**Migrations:** none

**Rollback:** n/a

---

## StorefrontHomeEditor CMS

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none)

**Behavior Implemented:** `packages/platform-data/src/storefront-home-cms.ts` implements `getStorefrontHomeContent` and `upsertStorefrontHomeContent` with merge semantics; admin editor component exists.

**Missing For Completion:** E2E or integration test for admin save to storefront read in a staging project.

**Validation:** integration or E2E for CMS round-trip: NOT DONE.

**Migrations:** confirm `storefront_home_content` schema matches writers

**Rollback:** n/a

---

## CmsPageBlocksEditor

**Status:** NOT DONE

**Scope Match:** PARTIAL

**Files Changed:** (none)

**Behavior Implemented:** `apps/admin/src/components/cms/CmsPageBlocksEditor.tsx` present.

**Missing For Completion:** Block add/remove/reorder, type switching, API persistence verified by tests.

**Validation:** admin E2E or API contract tests.

**Migrations:** as required by block schema

**Rollback:** n/a

---

## loyalty admin page

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none)

**Behavior Implemented:** `apps/admin/src/app/(dashboard)/admin/loyalty/page.tsx` wires enroll, rewards, points adjust, and lookup via `/api/admin/loyalty/*` (per source trace).

**Missing For Completion:** **Checkout coupling:** points do not change cart totals; align with `docs/data-ownership.md` and Medusa Promotions (see [CORRECTED-AUDIT-AND-OSS-GAPS.md](./CORRECTED-AUDIT-AND-OSS-GAPS.md) Gap B). Single-ledger ADR still required (item 22).

**Validation:** integration tests for ledger APIs: not verified. checkout redemption: NOT DONE.

**Migrations:** align with chosen loyalty model (see item 22)

**Rollback:** feature flag or route removal

---

## devices registry page

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none)

**Behavior Implemented:** `apps/admin/src/app/(dashboard)/admin/devices/page.tsx` implements create, edit with config patch, and list flows against `/api/admin/devices` (per source trace).

**Missing For Completion:** E2E with `pos_devices` rows and heartbeat UI verification in CI.

**Validation:** manual or E2E with test device rows: NOT DONE in CI.

**Migrations:** none if schema stable

**Rollback:** n/a

---

## CmsExperimentsManager

**Status:** NOT DONE

**Scope Match:** PARTIAL

**Files Changed:** (none)

**Behavior Implemented:** `apps/admin/src/components/cms/CmsExperimentsManager.tsx` persists experiment rows and references `docs/cms-experiment-storefront-keys.md`; SDK exports `cms-experiment-pick`.

**Missing For Completion:** Confirm storefront uses `cms-experiment-pick` for assignment and metrics, **or** adopt GrowthBook and retire custom storage (see [CORRECTED-AUDIT-AND-OSS-GAPS.md](./CORRECTED-AUDIT-AND-OSS-GAPS.md) Gap D).

**Validation:** E2E with variant assignment: NOT DONE.

**Migrations:** possible experiment assignment tables

**Rollback:** remove UI routes

---

## campaigns page vs Medusa promotions

**Status:** NOT DONE

**Scope Match:** PARTIAL

**Files Changed:** (none)

**Behavior Implemented:** `apps/admin/src/app/(dashboard)/admin/campaigns/page.tsx` calls `POST /api/admin/campaigns/:id/execute` and displays `sent` count (per source trace).

**Missing For Completion:** **Verify** `execute` route actually invokes Resend (or other mailer) versus only updating timestamps; align with `docs/data-ownership.md` (messaging vs Medusa price rules).

**Validation:** integration test with mail mock; checkout price regression tests if promotions are coupled.

**Migrations:** none for messaging-only path

**Rollback:** revert promotion links

---

## CrmClientEnhancements

**Status:** NOT DONE

**Scope Match:** PARTIAL

**Files Changed:** (none)

**Behavior Implemented:** `apps/admin/src/app/(dashboard)/admin/crm/CrmClientEnhancements.tsx` exists.

**Missing For Completion:** Complete enhancement behaviors or narrow product name to match actual capabilities.

**Validation:** manual CRM workflows.

**Rollback:** n/a

---

## ChatIntakeForm and chat intake API

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none)

**Behavior Implemented:** Intake route uses hardcoded `email: "chat-intake@instore.local"` in `apps/admin/src/app/api/integrations/chat-orders/intake/route.ts`.

**Missing For Completion:** `CHAT_INTAKE_EMAIL` (or similar) env with validation; complete draft conversion and item entry flows per checklist.

**Validation:** API unit test for env resolution; UI test for intake.

**Migrations:** none

**Env / Config:** new env for intake identity

**Rollback:** revert env requirement with default for dev only

---

## AccountProfilePanel storefront

**Status:** NOT DONE

**Scope Match:** PARTIAL

**Files Changed:** (none)

**Behavior Implemented:** `apps/storefront/src/components/AccountProfilePanel.tsx` exists; checkout uses profile gate in `use-checkout-client.ts`.

**Missing For Completion:** Verify all profile fields persist via Medusa customer APIs and match onboarding contract.

**Validation:** E2E profile edit and checkout gate.

**Migrations:** none

**Rollback:** n/a

---

## sdk i18n

**Status:** NOT DONE

**Scope Match:** CHANGED

**Files Changed:** (none)

**Behavior Implemented:** `packages/sdk/src/i18n.ts` implements `t`, `formatCurrency`, `formatDate`, `formatNumber`, `detectLocale`, and registers core `en-PH` keys (per source trace).

**Missing For Completion:** Parity tests for all exported locales used in production; expand `fil-PH` / `en-US` dictionaries if those locales are marketed to customers.

**Validation:** unit tests for locale coverage: NOT DONE.

**Rollback:** n/a

---

## Admin API staff guard and error redaction

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none)

**Behavior Implemented:** `pnpm run check:admin-api-guard` script exists.

**Missing For Completion:** Zero unguarded routes in CI output; centralized redaction for admin API error logs per `docs/security-program.md`.

**Validation:** run guard in CI locally; spot-check logs for secrets.

**Migrations:** none

**Rollback:** n/a

---

## PayPal webhook ID production enforcement

**Status:** NOT DONE

**Scope Match:** PARTIAL

**Files Changed:** (none)

**Behavior Implemented:** `apps/medusa/src/loaders/validate-process-env.ts` enforces `PAYPAL_WEBHOOK_ID` in production when PayPal client is configured; tests in `validate-process-env.unit.spec.ts` and PayPal module tests.

**Missing For Completion:** Operator checklist and deployment verification on each environment; ensure no storefront-only duplicate requirement is missing if webhooks hit another app.

**Validation:** existing Medusa unit/stress tests; production dry-run.

**Env / Config:** `PAYPAL_WEBHOOK_ID`

**Rollback:** n/a

---

## CHANNEL_WEBHOOK_SECRET enforcement breadth

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none)

**Behavior Implemented:** `apps/admin/src/lib/channel-webhook-policy.ts` and `apps/admin/src/app/api/integrations/channels/webhook/route.ts` read secret; policy distinguishes environments.

**Missing For Completion:** Enforce secret on all non-development deployments (including staging) per checklist, not only Vercel production / `NODE_ENV=production` matrix.

**Validation:** matrix test for `VERCEL_ENV` / custom staging flags.

**Migrations:** none

**Rollback:** policy revert

---

## Supabase service role rotation

**Status:** BLOCKED

**Scope Match:** PARTIAL

**Files Changed:** (none)

**Behavior Implemented:** Manual process described in security docs; no automated rotation in repo.

**Missing For Completion:** Documented calendar; optional CI guard if team adopts dated env metadata or secrets manager API.

**Validation:** operational audit trail.

**Blocking Reason:** Requires organizational secrets manager or Vercel or Supabase policy outside repo code. A CI guard for days-since-rotation needs a trusted timestamp source not defined in this codebase.

**Rollback:** n/a

---

## Loyalty balance single source of truth

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none)

**Behavior Implemented:** `docs/data-ownership.md` states unresolved dual-ledger risk.

**Missing For Completion:** ADR accepting Supabase-only, Medusa-only, or sync protocol; code changes to eliminate duplicate balances.

**Validation:** reconciliation job or tests proving single ledger.

**Migrations:** possible if moving ledger

**Rollback:** revert ADR implementation

---

## digital_receipts and pos_voids medusa_order_id

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none)

**Behavior Implemented:** Docs describe backfill in `docs/data-ownership.md`.

**Missing For Completion:** DB `NOT NULL` + migration for new rows, or application assertion on insert paths.

**Validation:** migration test + insert integration test.

**Migrations:** new constraint migration in `packages/database`

**Rollback:** drop constraint migration

---

## cart_abandonment_events recovery email dedup

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none)

**Behavior Implemented:** `apps/storefront/src/app/api/cart/abandonment/route.ts` counts prior sends in 48h window in application logic.

**Missing For Completion:** DB uniqueness or idempotency key constraint for `(email, campaign window)` or equivalent to survive races.

**Validation:** concurrency test or SQL constraint violation test.

**Migrations:** partial unique index or dedup table

**Rollback:** drop index

---

## E2E payment provider matrix in critical suite

**Status:** NOT DONE

**Scope Match:** EXACT

**Files Changed:** (none)

**Behavior Implemented:** `package.json` script `test:e2e:critical` runs `full-commerce-journey`, `psp-checkout-cod`, API smoke, admin access only.

**Missing For Completion:** Add the remaining hosted payment flows to the critical script **or** add `test:e2e:payments-full` and gate releases on it when those payment providers are enabled.

**Validation:** CI job with secrets.

**Migrations:** none

**Rollback:** remove specs from script

---

## CI_STRICT_E2E default in release gate

**Status:** IMPLEMENTED

**Scope Match:** EXACT

**Files Changed:** (none in this pass)

**Functions / Classes Changed:** (n/a)

**Behavior Implemented:** `.github/workflows/e2e-release-gate.yml` sets `CI_STRICT_E2E: "1"` for `pnpm test:e2e:critical`.

**Missing For Completion:** Ensure all other CI workflows that run checkout E2E also set strict mode if they claim release readiness (grep `.github/workflows`).

**Validation:** inspect other workflows under `.github/workflows/` for E2E jobs without strict flag.

**Migrations:** none

**Env / Config:** `CI_STRICT_E2E`

**Rollback:** remove env line (not recommended)

---

## Extension — real-time admin updates (post checklist)

**Status:** NOT DONE

**Scope Match:** CHANGED (new gap from corrected investigation)

**Behavior Implemented:** Admin uses Supabase client libraries capable of Realtime; confirmed subscriptions on inventory or order UIs not documented in this verdict pass.

**Missing For Completion:** `postgres_changes` channels on operational tables for staff views that must not go stale.

**Validation:** manual or E2E with two browser sessions.

---

## Extension — production error tracking

**Status:** NOT DONE

**Scope Match:** CHANGED (new gap)

**Behavior Implemented:** Medusa lists `@opentelemetry/exporter-zipkin` in dev dependencies; not a substitute for user-visible error tracking across Next apps.

**Missing For Completion:** Deploy Sentry or self-hosted PostHog (or equivalent) on storefront, admin, and Medusa HTTP surfaces.

**Validation:** forced error event reaches dashboard in staging.

---

## Extension — durable background jobs

**Status:** NOT DONE

**Scope Match:** CHANGED (new gap)

**Behavior Implemented:** Webhooks and campaigns run in request lifecycle; long work risks timeout.

**Missing For Completion:** Queue or workflow engine (Trigger.dev, Inngest, or equivalent) with retries for payment reconciliation, campaign send, and webhook processing.

**Validation:** kill mid-job and observe retry to success in staging.

---

## Extension — distributed rate limiting

**Status:** NOT DONE

**Scope Match:** CHANGED (new gap)

**Behavior Implemented:** `@universal-music-store/rate-limits` provides application-level limiting.

**Missing For Completion:** Redis-backed limits (for example Upstash) in middleware for consistent caps across serverless instances.

**Validation:** load test from multiple regions or instances.

---

## Final Verdict

**Checklist Items (1–26 only):**

- Implemented: 1
- Blocked: 1
- Not Done: 24

**Extension gaps (27–30 documented above):** all **NOT DONE** until implemented and validated.

**Spec Drift Detected:** Yes. **Revision 2:** false-positive `TODO` grep; several surfaces are **wired in source** while checklist text implied stub-heavy files. See [CORRECTED-AUDIT-AND-OSS-GAPS.md](./CORRECTED-AUDIT-AND-OSS-GAPS.md). **Gap F correction:** `CI_STRICT_E2E` **is** set on `e2e-release-gate.yml`; any claim it is unset refers to **other** workflows or older branches.
