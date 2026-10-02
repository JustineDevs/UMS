# Production Observability Runbook

This runbook defines the signals that must be monitored for the storefront and
Cloudflare Worker. It is an operational contract, not evidence that the
corresponding dashboards or alerts have already been provisioned.

## Health probes

| Signal | Endpoint | Meaning | Alert condition |
|---|---|---|---|
| Worker liveness | `/healthz` | Worker process is responding | 2 consecutive failures in 5 minutes |
| Worker readiness | `/readyz` | APP and Medusa database roles are reachable | Any 503 for 2 consecutive checks |
| Storefront liveness | `/api/health` | Next.js process is responding | 2 consecutive failures in 5 minutes |
| Storefront readiness | `/api/health/sop` | Storefront can reach the dependency-aware Worker probe | Any 503 for 2 consecutive checks |

Do not use `/health`, `/healthz`, or `/api/health` as a database-readiness
signal. `/readyz` and `/api/health/sop` are the only dependency-aware probes.

## Queue and retry signals

Cloudflare Queues are configured with eight retries and environment-specific
dead-letter queues in `wrangler.jsonc`:

- `uvs-commerce-dev-dlq`
- `uvs-commerce-production-dlq`

Alert when production DLQ depth is non-zero, when the oldest queued message is
older than 10 minutes, or when a single job reaches its terminal retry budget.
The queue consumer must preserve the failed message and its correlation ID for
operator replay; a successful HTTP response alone is not queue proof.

## Payment reconciliation

Monitor the scheduled payment recovery and reconciliation jobs using the
Admin → Payment attempts view and the bounded
`/api/admin/commerce-recovery-metrics` endpoint. Page an operator when:

- any payment attempt remains pending beyond 15 minutes;
- a reconciliation run fails twice consecutively;
- a settlement discrepancy is recorded;
- a provider callback signature or replay check fails repeatedly.

The recovery path is server-owned and idempotent. Do not resolve a payment
incident by changing storefront state directly or by calling `cart.complete`
from the browser.

## Evidence required before production onboarding

The scheduled `deployed-health-contract` workflow runs every 15 minutes against
the public Worker and storefront origins. It fails when either Worker is not
ready, when either database role is unavailable, or when the storefront exposes
the retired health contract. A failed run is deployment/runtime evidence and
must be investigated before onboarding paid traffic.

Retain, per deployment:

1. the deployed commit SHA and Worker environment name;
2. fresh `/readyz` and `/api/health/sop` responses;
3. queue depth and DLQ screenshots or API exports;
4. payment reconciliation results for each enabled provider;
5. alert delivery evidence from the configured monitoring system;
6. rollback owner, timestamp, and recovery result.

Local source tests prove the contracts and failure handling. They do not prove
that a hosted monitoring system delivered an alert or that a provider callback
reached the deployed Worker.
