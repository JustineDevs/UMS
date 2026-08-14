# Security Review Schedule

## Quarterly Review Cadence

| Quarter | Focus Area | Owner | Deliverable |
|---------|-----------|-------|-------------|
| Q1 | RLS policies audit | Platform | Updated RLS matrix, gap report |
| Q2 | Rate-limit review on public routes | Backend | Rate limit config per route, load test results |
| Q3 | Log redaction audit | Platform | Redaction rules verified, PII scan report |
| Q4 | Dependency and supply chain review | DevOps | SBOM generated, CVE report, license compliance |

## Review Procedures

### RLS Policy Review (Q1, Q3)
1. Export all Supabase RLS policies using `supabase inspect db policies`
2. Map each table to its expected access pattern (service_role, authenticated, anon)
3. Verify no table with PII or financial data allows anon access
4. Verify staff tables require role checks
5. Document exceptions with justification

### Rate-Limit Review (Q2, Q4)
1. List all public routes (storefront API, auth, webhooks)
2. Verify each has rate limiting configured
3. Test limits with load tool (k6 or similar)
4. Review webhook endpoints for replay protection

### Log Redaction Audit (Q3)
1. Search logs for PII patterns (email, phone, card numbers)
2. Verify redaction middleware is active on all log sinks
3. Check error responses do not leak internal state
4. Verify audit_logs table does not store raw secrets

### Dependency Review (Q4)
1. Run SBOM generation
2. Run `npm audit` and `pnpm audit`
3. Review high/critical CVEs
4. Check license compatibility
5. Update pinned versions

## Rate-Limit Configuration

| Route Pattern | Limit | Window | Action |
|--------------|-------|--------|--------|
| POST /api/auth/* | 10 req | 1 min | Block IP |
| POST /api/cart/* | 30 req | 1 min | Throttle |
| POST /api/reviews | 5 req | 5 min | Throttle |
| POST /api/forms/* | 10 req | 5 min | Throttle |
| GET /api/shop/* | 60 req | 1 min | Throttle |
| POST /api/hooks/* (webhooks) | 100 req | 1 min | Log + allow |
| POST /api/admin/* | 60 req | 1 min | Throttle |
| GET /api/health/* | No limit | - | - |

## Incident Response Triggers
- Any failed RLS test: P0, fix within 24 hours
- Rate limit bypass found: P1, fix within 48 hours
- PII in logs: P0, redact + rotate affected credentials
- Critical CVE in dependency: P1, patch within 72 hours
