# Storefront and Admin: Production Audit, Trace, QA, and Engineering Notes

Date: 2026-03-26  
Scope: `apps/storefront`, `apps/admin`, shared packages consumed by those apps (`packages/sdk`, `packages/platform-data`, `packages/validation`, `packages/database`).  
Medusa and Express are referenced for boundaries only; full Medusa audit is out of scope for this document.

---

## What you are missing (read this first)

A complete “every weakness in the entire application” list is not something a single document can honestly claim without continuous CI, staging runs, and security tooling. This file captures **evidence-based** gaps and **non-negotiable** items for storefront and admin. It does **not** replace runtime load tests, penetration tests, or owner sign-off.

If you justify skipping strict RBAC or skipping staging because you are solo, you are trading away production honesty for speed. The better story: you ship with a **finite gate list** and dated follow-ups.

---

## 1. Short narrative (customer and staff)

**Customer:** Opens the Next.js storefront, browses Medusa-backed catalog, uses cart and checkout. Payment and order state are owned by Medusa workflows and providers configured in `apps/medusa`. Storefront reads public CMS content from Supabase where wired (anon client, RLS). Tracking uses shared secrets when configured (`TRACKING_HMAC_SECRET`).

**Staff:** Signs in with Google via NextAuth on the admin app. Middleware requires staff or admin role. Server routes under `/api/admin/*` use session plus `staffHasPermission`. Commerce calls use `MEDUSA_SECRET_API_KEY` only on the server. Platform data uses Supabase service role in route handlers.

---

## 2. Wiring health map (trace)

Legend: **Wired** = code path exists end-to-end. **Partial** = depends on env, degraded mode, or incomplete UX. **Broken** = missing route or unsafe default without mitigation.

| Flow | Hops | Status |
|------|------|--------|
| Storefront shop list | `shop/page.tsx` → Medusa Store API / SDK helpers | **Wired** (fails soft when Medusa down where bridges handle it) |
| Storefront PDP | `shop/[slug]/page.tsx` → Medusa | **Wired** |
| Cart | Client `cart.ts` + Medusa cart APIs | **Wired** |
| Checkout | Checkout page → Medusa payment sessions | **Partial** (provider-specific; must match Medusa env) |
| CMS pages | `p/[slug]`, blocks → Supabase | **Wired** when `SUPABASE_*` set |
| Admin inventory | Page → `medusa-inventory-bridge` / `/api/admin/inventory` | **Wired** |
| Admin orders | Bridges + `/api/medusa/*` | **Wired** |
| Admin POS | `pos/page.tsx` → `/api/pos/medusa/*` | **Wired** |
| RBAC sidebar | Session `permissions` → `staffHasPermission` | **Partial** until `NEXT_PUBLIC_STAFF_RBAC_STRICT=true` after grants seeded |

**MOCK / TODO:** Grep across `apps/storefront` and `apps/admin` for `TODO`, `STUB`, `MOCK` is clean except intentional labels (e.g. device driver “mock”). No systematic stub layer found in those two apps.

**CO-STAR UI:** `CO-STAR-PROMPT.md` / `CO-STAR-CREATOR.md` were **not found** in the repo. The `/ui` command has no local resource files to load.

---

## 3. Audit findings (storefront + admin)

| Component | Severity | Description | Recommended change |
|-----------|----------|-------------|-------------------|
| platform-data / RBAC | **high** | Empty permission lists and missing grant rows historically **allowed all** keys (`staffHasPermission`, `resolveStaffPermissionsForUserId`). | Enable fail-closed mode after seeding `staff_permission_grants`: set `NEXT_PUBLIC_STAFF_RBAC_STRICT=true` (implemented in this pass). |
| Storefront CMS HTML | **high** | `dangerouslySetInnerHTML` used for CMS body and blocks. | Sanitize server-side or restrict CMS editors to staff-only and add CSP where hosting allows. |
| Storefront secrets | **medium** | Ensure `MEDUSA_SECRET_API_KEY` never appears in `NEXT_PUBLIC_*` or client bundles. | Grep CI check; Next.js env audit in build. |
| Admin layout | **low** | Fixed sidebar + mobile drawer implemented in `AdminDashboardChrome.tsx`. | Verify on real devices; tune focus trap if a11y audit fails. |
| Duplication | **medium** | Many `fetch` calls in client components across admin. | Introduce thin typed clients per domain when you touch those files (no big-bang rewrite). |
| Testing | **medium** | E2E lives under `stress-test/e2e`; not every admin route is covered. | Add smoke tests for login, one CMS save, one order view. |

---

## 4. QA report (sections 1–10, condensed)

**Architecture:** Medusa owns commerce. Supabase owns platform identity, RBAC, CMS rows. Next route handlers are BFFs. Weakness: business rules scattered across handlers instead of small services in `packages/`.

**Data:** Two Postgres concerns (Medusa DB vs Supabase). No single table for “orders” in Supabase for live checkout when Medusa is authoritative.

**Auth:** NextAuth for both apps with different `NEXTAUTH_URL`. Admin staff gated in middleware. **RBAC strict flag** aligns server and client when enabled.

**Order and inventory:** Implemented in Medusa; admin reads via Admin API. Inventory movement immutability is Medusa’s model, not duplicated in Supabase for live stock.

**SDKs:** Centralize env via `packages/sdk`. Payment webhooks live on Medusa, not `apps/api`, per spec.

**Storefront and admin UI:** Shell patterns differ (`AdminPageShell` vs `CmsPageFrame`). Acceptable if documented.

**Testing / observability:** Request correlation exists in several staff APIs. Full metrics stack not asserted from static review.

**Duplication:** See audit table.

**Evolution:** Multi-region and multi-currency need config-driven Medusa setup; hardcoded PHP assumptions are a future tax.

**Prioritized actions:** See section 8.

---

## 5. Design, develop, maintain (engineering practice)

**Design:** Boundaries first (ADR-0001, ADR-0002). One paragraph per system of record in internal docs. **Weak practice:** growing Next handlers without extracting pure functions into `packages/` for testability.

**Coding standards:** ESLint + TypeScript strictness as configured. Prefer explicit errors over silent catch on commerce paths.

**Maintenance:** Versioned migrations in `packages/database/supabase/migrations`. Run `pnpm --filter @universal-music-store/database migrate` in staging before prod. Track dependency updates; `pnpm audit` in CI.

---

## 6. Code, review, testing, deployment

**Review:** Block PRs that add fail-open auth, secrets in client, or cross-write commerce into Supabase.

**Testing:** Unit tests in `packages/platform-data` for permission logic. Integration tests for Medusa modules where present. E2E for golden paths.

**Deployment:** Vercel or self-host; set `NEXTAUTH_URL` per app. **RBAC:** enable `NEXT_PUBLIC_STAFF_RBAC_STRICT` only after grants exist.

---

## 7. Performance, scalability, reliability

**Performance:** Measure p95 for storefront TTFB and checkout API; Medusa DB indexing for catalog queries.

**Scalability:** Stateless Next apps; scale Medusa workers and DB for load.

**Reliability:** Health endpoints (`apps/api`), Medusa boot validation, webhook idempotency in Medusa subscribers. **You** still need alerts on 5xx and webhook failures for true production operations.

---

## 8. Hardening findings log (this pass)

| ID | Component | Severity | Finding | Fix status |
|----|-----------|----------|---------|------------|
| H-029 | platform-data | High | Fail-open RBAC when grants empty or permission list empty | **Fixed:** `isStaffRbacStrictEnv()`, `NEXT_PUBLIC_STAFF_RBAC_STRICT` / `STAFF_RBAC_STRICT`, tests updated |
| H-030 | Docs | Medium | Operator notes missing for RBAC strict rollout | **Fixed:** this file + `.env.example` |
| — | Stress | — | Live adversarial e2e not executed in this session | **Blocked:** requires running stack + credentials |
| — | OWASP full pass | — | Manual A01–A10 review not completed here | **Deferred:** schedule security review |

---

## 9. Engineer / stress / blueprint verdict

**Ship verdict for storefront + admin codepaths reviewed:** **Conditionally ready** for production user onboarding **if**:

1. `staff_permission_grants` is populated for each staff user **before** enabling `NEXT_PUBLIC_STAFF_RBAC_STRICT=true`.
2. Medusa, Supabase, and NextAuth env vars are set correctly on the target host.
3. CMS HTML risk is accepted or mitigated (editor trust + CSP).

**Stress command:** Not executed against a live deployment in this pass. Treat “production ready” claims without metrics as **unproven**.

---

## 10. Prioritized action list (max 10)

1. **Seed RBAC then enable strict** (`packages/database`, Vercel env). Why: closes fail-open class. Effort: S after migrations exist.
2. **CSP or sanitize CMS HTML** (storefront). Why: XSS surface. Effort: M.
3. **Smoke e2e** for login + CMS + checkout (stress-test). Why: regression safety. Effort: M.
4. **Typed admin API client layer** (incremental). Why: fewer auth mistakes. Effort: L.
5. **Structured logging audit** on `/api/admin/*`. Why: incident response. Effort: M.
6. **Customer-facing error copy** pass on storefront. Why: UX under failure. Effort: S.
7. **Remove or gate any remaining misleading UI** (engineer command). Why: trust. Effort: S–M.
8. **Document Medusa payment providers** vs Lemon in `internal/docs` if drift. Why: operator clarity. Effort: S.
9. **Backup and retention** runbook for Medusa DB and Supabase. Why: PDPA alignment. Effort: M.
10. **Add CO-STAR resources** if you want `/ui` command to resolve. Why: workflow. Effort: S.

---

## 11. Commit grouping suggestion

- `fix(auth): fail-closed staff RBAC when NEXT_PUBLIC_STAFF_RBAC_STRICT is set`
- `test(platform-data): strict RBAC cases for staffHasPermission`
- `docs: storefront and admin production audit and env example for RBAC strict`

---

*End of report.*
