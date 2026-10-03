# Architecture glossary and technology dossier — 2026-09-29

This dossier distinguishes **implemented capability**, **configured capability**, and **verified production evidence**. A technology appearing in `package.json`, a design document, or `wrangler.jsonc` is not by itself proof that the capability is active in production.

## Current production evidence refresh — 2026-09-29

The production Worker was redeployed as version `8f8f346a-1f10-4d20-b0d4-3c986751d732`. Its `/readyz` endpoint returned HTTP 200 with both database roles ready, and the public Vercel health-contract check passed. The authenticated runtime-settings API revealed that the organization had only `COD` enabled; the full settings payload was preserved and `XENDIT` was added through the audited idempotent admin route. Both the Worker and Vercel now advertise `XENDIT` and `COD`. A deployed Xendit hosted checkout passed, and failed/expired return paths passed 2/2. This is provider checkout evidence, not proof of webhooks, refunds, reconciliation, chargebacks, or broad production traffic behavior.

## System shape

```text
Shopper / staff browser
        |
        v
Next.js App Router on Vercel
        |  SSR, route handlers, middleware, UI, auth session
        v
Cloudflare Worker on Wrangler
        |  auth, RBAC, commerce orchestration, webhooks, queues
        +--> Medusa PostgreSQL through MEDUSA_HYPERDRIVE
        +--> Application PostgreSQL through APP_HYPERDRIVE
        +--> Stripe / PayPal / Xendit / COD / logistics / email providers
        +--> Cloudflare Queue + DLQ for durable asynchronous work
```

## Technology inventory and how the system leverages it

| Technology | Capability actually used | Boundary/contract | Evidence level |
|---|---|---|---|
| pnpm workspaces + Turborepo | Monorepo package graph and task orchestration | Frozen lockfile in CI; package scripts | Implemented/local verified |
| Next.js 15 App Router | Storefront, account, checkout, admin, SSR, route handlers | Middleware and route ownership checks | Implemented/local verified |
| React + TypeScript | UI composition and typed application logic | Root typecheck, package typechecks | Implemented/local verified |
| Tailwind + shadcn/Radix UI | Shared visual primitives and responsive styles | `packages/ui`, web components, responsive contract | Implemented/local verified |
| Vercel | Storefront deployment target and public edge delivery | `apps/web`, Vercel runbook | Configured; current source equivalence not proven |
| Cloudflare Workers | Stateless edge API, auth boundary, provider calls, webhook ingress | `workers/backend/src/router.ts`, Wrangler | Implemented/local verified |
| Cloudflare Hyperdrive | Role-specific Postgres connectivity/pooling at Worker edge | `APP_HYPERDRIVE`, `MEDUSA_HYPERDRIVE` | Configured; live binding proof pending |
| Cloudflare Queues | Durable async commerce/notification work and retries | Queue consumer, max retries, DLQ, operator thresholds | Implemented/configured; live lag and alert-delivery evidence pending; see `docs/runbooks/OBSERVABILITY.md` |
| PostgreSQL / Supabase | Application/platform tables, RLS, migrations, audit, CMS, operations | Migration registry and RLS SQL | Implemented/local DB verified |
| Medusa PostgreSQL | Commerce source of truth | Worker role boundary; no duplicate live commerce authority in APP DB | Implemented by contract; live schema proof pending |
| Supabase Auth SSR | Browser/session auth and Google OAuth integration | Middleware/session helpers; Worker JWT verification | Implemented/local verified; live auth journey pending |
| Web Crypto/JWKS | JWT verification, HMAC/internal tokens, webhook signatures | `workers/backend/src/auth.ts` and webhook modules | Implemented/tested |
| Stripe | Hosted/payment checkout, catalog sync/refund paths | Worker provider adapter and webhook flow | Current production merchant context has Stripe disabled; strict local checkout rerun did not reach confirmation; webhook/refund proof pending |
| PayPal | Order creation, capture/confirmation, refund paths | Worker provider adapter | Local sandbox checkout-to-return passed; webhook/refund proof pending |
| Xendit | Hosted checkout/session and callback flow | HTTPS callback contract and provider adapter | Deployed hosted checkout passed; failed/expired returns passed 2/2; webhook/refund/reconciliation proof remains open |
| COD | Non-PSP order path and fulfillment/payment state handling | Explicit provider capability | Current strict local checkout rerun did not reach confirmation; operational fulfillment proof pending |
| J&T Express | Shipment/tracking integration target | Logistics bridge/configuration | Config/code evidence; carrier verification pending |
| Resend | Transactional email provider | `packages/resend-mail`, Worker jobs | Code/config evidence; delivery proof pending |
| Nango | Payment/integration connection and signed webhook path | HMAC verification and replay table | Code/tests; live callback proof pending |
| PostHog | Product/operational event analytics and consent-aware client tracking | SDK env checks and analytics bridge | Code/config evidence; event delivery/SLO proof pending |
| Vercel Analytics | Web performance/traffic telemetry | Storefront client integration | Code/config evidence |
| BotId/reCAPTCHA | Bot/abuse friction at the web boundary | Middleware/client integration | Code/config evidence; attack simulation pending |
| Zod/sanitize-html/htmlparser2 | Input, response, CMS and URL validation | Shared validation and CMS preview/publish boundaries | Implemented/local verified |
| Playwright | Browser smoke, API, workflow, accessibility, and provider test harnesses | `scripts/stress-test/e2e` | Local matrix 13 passed / 5 skipped / 0 failed; deployed Xendit success passed and negative returns passed 2/2 |
| Gitleaks | Secret pattern scanning in CI | Security workflow | Workflow configured; fresh remote result pending |
| Trivy | Filesystem vulnerability scanning for high/critical findings | Security workflow | Workflow configured; fresh remote result pending |
| Semgrep | Static TypeScript/Node/OWASP/React analysis | Security workflow | Workflow configured; fresh remote result pending |
| Knip | Unused files, dependencies, and exports | `pnpm quality:knip` | Current graph is clean with no findings |

## Architecture glossary

### Source of truth (SoT)
The system authorized to own a domain’s authoritative state. In this platform, Medusa owns live commerce state; the application database owns platform/operations state.

### System of record (SoR)
Operationally equivalent to source of truth, emphasizing that other systems must reference or derive from it rather than compete with it.

### Bounded context
A domain boundary with its own language, ownership, invariants, and persistence rules. Commerce, CMS, RBAC, POS operations, logistics, and analytics should not silently share authority.

### Data ownership boundary
The rule that prevents duplicated live catalog/order/inventory/payment state between Medusa and the application database. The canonical policy is `docs/data-ownership.md`.

### Anti-corruption layer / bridge
A translation boundary that maps one system’s model to another without leaking ownership. The Worker bridge is the main implementation surface.

### Edge runtime
The Cloudflare Worker execution environment. Code must be stateless per request, use Worker-compatible APIs, and avoid Node-only assumptions.

### SSR
Server-side rendering. Next.js resolves server data and session state before returning HTML, while the browser hydrates interactive components.

### Middleware
The request boundary that applies route policy, session handling, request IDs, rate limits, and redirect behavior before a Next route executes.

### Hyperdrive
Cloudflare’s database connectivity/pooling binding. This repository uses separate APP and MEDUSA bindings so the Worker can reach each ownership domain explicitly.

### Queue / DLQ
A queue defers work from the request path. A dead-letter queue stores messages that exhausted retry policy or were quarantined, requiring operator ownership.

### Idempotency
The property that repeating the same mutation key does not create duplicate side effects. Payment, catalog, fulfillment, POS, CMS, and integration mutations use idempotency stores or keys in relevant paths.

### Webhook replay protection
A durable event identifier/nonce prevents the same provider callback from applying its state transition twice.

### Liveness
Whether the process/runtime is alive enough to receive traffic. It should not claim dependency readiness.

### Readiness
Whether required dependencies and contracts are available for the process to safely serve traffic. This repository’s Worker `/readyz` is the closest current implementation because it probes both database roles.

### Health endpoint
An externally consumed status endpoint. Its meaning must be explicit; an always-200 endpoint is dangerous if monitoring treats it as readiness.

### RLS
PostgreSQL row-level security. It constrains which authenticated database roles can read or mutate rows, complementing—not replacing—application authorization.

### RBAC
Role-based access control. Staff permissions are checked at the Worker/admin boundary and should be paired with tenant/organization scoping.

### Contract test
A test that protects an interface or boundary: OpenAPI/source parity, route ownership, migration ownership, client/server import boundaries, response schemas, or provider payload shape.

### Provider-backed test
A test that talks to a real provider sandbox or controlled external service. Mocks validate local adapter logic; they do not prove credentials, callback delivery, provider state, network behavior, or reconciliation.

### Deployment provenance
Evidence that the artifact currently serving production was built from a specific reviewed commit, with the expected root directory, environment, bindings, and secrets.

### SLO
A measurable service objective such as availability, checkout completion latency, payment-finalization latency, queue age, or reconciliation freshness. Logs and analytics are inputs; an SLO requires a threshold, window, owner, and alert.

### Operational readiness
The combination of deployment provenance, secrets/bindings, dashboards, alerts, runbooks, rollback, backups/restore, provider recovery, and accountable on-call ownership.

### Production-grade
A claim that requires both sound implementation and evidence in the target environment. Passing typecheck or unit tests alone is not enough.

## What the current dossier proves—and does not prove

### Proven locally

- The repository compiles and lints through the current root gates.
- Database migrations are deterministic and the configured database reports no pending migrations.
- Route, migration, client-boundary, OpenAPI, webhook-boundary, and security hygiene checks pass.
- The architecture has explicit ownership and several meaningful hardening controls.

### Not proven yet

- Every deployed artifact matches this reviewed source.
- Every configured secret and binding is present and correctly scoped.
- Every payment provider completes a real checkout/webhook/reconciliation journey.
- The system meets latency, throughput, queue-lag, error-budget, or cost objectives.
- Monitoring will detect dependency failure rather than accept a false-green response.

## Dossier conclusion

The stack is being used in a purposeful way, and its inventory of capabilities is materially leveraged in the implementation. The weak point is not the existence of technologies; it is the evidence chain around them. Treat this dossier as an architecture/evidence map, not a certification. The production gate should remain **Not ready** until the external proofs and health semantics are closed.
