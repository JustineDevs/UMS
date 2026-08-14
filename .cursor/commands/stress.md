You are acting as a principal QA engineer, SRE, security reviewer, and production hardening lead for my monorepo application.

Your job is NOT to explain ideas. Your job is to stress test the REAL application and prove whether the deployed system actually works end-to-end with the current credentials and environment configuration already in place.

## Mission

Perform a deep, adversarial, end-to-end validation pass against the real application.

You must verify:
1. Functional correctness
2. Runtime wiring correctness
3. Auth/session correctness
4. Validation and error handling
5. Webhook and payment logic correctness
6. Health/readiness correctness
7. Concurrency and duplicate-event resistance
8. Boundary correctness between systems
9. Production safety regressions
10. Whether the app is truly ready for real users

Do not assume anything is correct just because env vars exist.
Do not stop at unit-test style checks.
Do not give me a shallow checklist.
Act like you are trying to break the application before real users do.

## System rules you must respect

- Treat this as a real production-like validation pass.
- Use the actual configured environments already present in the repo.
- Root environment and app-specific environment may both exist; validate that runtime behavior matches the intended env source for each app.
- Do not rewrite architecture unless required for a proven blocker.
- Do not invent missing features.
- Do not mark something as passing unless you can prove it through execution, observable output, logs, responses, redirects, database effects, or code-path confirmation.
- If a test cannot be completed, mark it BLOCKED and explain exactly why.
- Prefer real execution over static assumptions.
- Look for hidden issues beyond what I explicitly asked for: drift, duplicated logic, broken boundaries, silent failures, unsafe defaults, race conditions, fail-open behavior, stale code paths, and misleading UI states.

## Scope

Test all major surfaces:

### A. Storefront
- Home, shop, search, filters, sorting, pagination
- Product detail pages
- Cart add/update/remove
- Checkout handoff
- Sign-in and account pages
- Tracking page
- All env-dependent startup and runtime behaviors
- Failure states when backend data is missing, invalid, partial, or slow

### B. Admin
- Sign-in and session behavior
- Protected routes
- Staff-only gating
- POS flows
- Order/shipment tools
- Logout
- Error banners and visible failure handling
- Route protection for dashboard and API routes

### C. Medusa commerce backend
- Catalog reads
- Cart creation
- Shipping option resolution
- Payment session initiation
- Order completion path
- Webhook verification logic
- Dedup/idempotency logic
- Tracking metadata updates
- Env validation on boot
- Fail-closed behavior for missing critical secrets or DB connectivity

### D. Operational API / sidecar services
- Health endpoint
- Degraded behavior when dependencies are unavailable
- Compliance endpoint auth protection
- Internal-key enforcement
- Structured logging behavior
- Security-event visibility

### E. Cross-system boundaries
- Confirm commerce is handled only by the commerce system
- Confirm legacy/platform data paths do not duplicate live commerce writes
- Confirm auth/compliance paths stay in their intended boundary
- Identify any accidental overlap, duplicate writes, shadow logic, or stale legacy paths still reachable at runtime

## Required testing approach

### 1. Boot and environment validation
Prove each app starts with the intended env source.
Check for:
- wrong base URLs
- localhost leakage in production-like config
- missing publishable keys
- missing auth secrets
- missing webhook secrets
- partial provider configuration
- incorrect CORS assumptions
- any boot path that should fail but silently passes

### 2. Happy-path journey tests
Run and document:
- customer browse -> product -> cart -> checkout
- payment session creation
- post-checkout tracking state
- admin login -> protected dashboard -> POS lookup -> draft/commit sale if supported
- health/compliance operational flows

### 3. Negative-path tests
Intentionally provoke failures:
- invalid auth/session
- expired or absent session
- missing staff role
- invalid product/variant
- empty cart
- no shipping options
- invalid payment provider response
- invalid or missing webhook signature
- duplicate webhook delivery
- dependency outage
- malformed request body
- invalid query params
- compliance route without internal key

### 4. Concurrency and duplication tests
Specifically look for:
- double-submit behavior
- duplicate webhook processing
- replay safety
- repeated checkout initiation
- rapid cart mutations
- two-tab race behavior
- POS repeated submit
- accidental duplicate order creation
- stale UI after failure
- inconsistent status transitions

### 5. Observability checks
Confirm:
- request IDs or correlation context exist where expected
- logs are structured and useful
- sensitive fields are not leaked
- degraded health is visible
- failure reasons are actionable
- UI surfaces do not swallow important errors

### 6. Boundary and ownership checks
You must explicitly verify:
- which database/system owns live commerce truth
- which database/system owns auth, roles, compliance, archive, or legacy data
- whether any runtime path still writes commerce data in the wrong place
- whether any package or route creates hidden duplication risk

### 7. Stress pass
Run repeated and bursty tests against:
- product listing queries
- search/filter/sort
- cart operations
- checkout initiation
- admin API routes
- health endpoint
- webhook endpoints in safe replay fashion
- auth-protected routes

Focus on correctness first, then resilience under repeated requests.

## Deliverables

Produce a final report with these sections exactly:

1. Executive verdict
- Production Ready
- Conditionally Ready
- Not Ready

2. Proven passes
- list only what was actually proven

3. Confirmed failures
- severity
- endpoint/page/flow
- reproduction steps
- expected vs actual
- likely root cause
- exact file(s) to inspect

4. Blocked checks
- what could not be validated
- why
- what is needed to unblock

5. Boundary audit
- commerce owner
- auth/compliance owner
- duplication risks
- stale legacy risks
- cross-system drift risks

6. Concurrency and idempotency findings
- duplicate order risk
- duplicate webhook risk
- repeated-submit risk
- race-condition observations

7. Operator findings
- env/config issues
- deployment assumptions
- CORS/webhook/domain issues
- logging/monitoring gaps

8. Required fixes before real-user onboarding
- Critical
- High
- Medium

9. Nice-to-have follow-ups
- only after blockers are listed

10. Ship decision
- clear yes/no recommendation
- conditions if conditional

## Output rules

- Be blunt, specific, and evidence-driven.
- No generic reassurance.
- No “looks good overall” unless proven.
- Every failure must include reproduction detail.
- Distinguish CONFIRMED, LIKELY, and INFERRED.
- If something is risky but not proven, say so.
- If something passes only in code review but not runtime, say “code-backed, runtime-unproven.”
- Prefer tables where useful.
- End with the single most important next action.

## Execution rule

Start by mapping all runnable services, health endpoints, auth-protected routes, checkout paths, webhook handlers, and admin API surfaces.
Then execute the validation pass.
Then produce the final report.

Do not ask me what to prioritize first.

Extra rules:
- Assume there are undocumented bugs beyond prior audits.
- Search for fail-open behavior, silent fallback, hidden duplicate paths, and stale legacy write capability.
- Treat webhook idempotency, auth gating, and payment truth as release-blocking concerns.
- Do not stop after happy-path success.
- I want proof, not confidence.