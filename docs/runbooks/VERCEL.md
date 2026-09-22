# Vercel Deployment (Unified Web App)

This runbook covers the unified Next.js web application on Vercel. It serves both customer-facing storefront routes and protected admin routes. Production also requires the reachable **Cloudflare Worker backend** configured by `API_URL`, **Supabase** (for the payment ledger, staff RBAC, and related platform data), and scheduled calls to the payment recovery cron route when using hosted checkout. See `docs/runbooks/PAYMENT-INTEGRATION.md` for the full payment lifecycle. The backend deployment contract is in `wrangler.jsonc`.

## Required Environment Variables

Set these in Vercel → Project → Settings → Environment Variables. Without them, customer-facing catalog routes show "Catalog service unavailable" or "Invalid URL".

| Variable | Description | Example |
|----------|-------------|---------|
| `API_URL` | Deployed Cloudflare Worker API origin | `https://<worker>.<account>.workers.dev` |

Do not set legacy `MEDUSA_*` storefront variables. The web application talks to
the Cloudflare Worker through `API_URL`; the Worker reaches the commerce database
through its configured Hyperdrive binding.

---

## Node.js Version

The project requires Node 20. Set in Vercel: **Settings → General → Node.js Version → 20.x**.  
The unified web app has `engines.node: "20.x"` and `.nvmrc`; Vercel should pick 20.x. If builds still use Node 24, set it explicitly in the dashboard.

Production customer-facing links should resolve to `https://universalmusic.vercel.app` unless a route-specific origin is documented elsewhere.

## Scheduled Operations

Vercel Hobby does not support the web app's five-minute operational cadence. Production scheduled calls are made by `.github/workflows/storefront-cron.yml` every five minutes. Configure the repository secret `STOREFRONT_CRON_SECRET` with the same value as production Vercel `CRON_SECRET`. The workflow invokes payment finalization, campaign execution, payment reconciliation, and inventory reservation routes with a bearer token; each route remains fail-closed without it.

---

## Required Settings

### 1. Root Directory
```
apps/web
```
**Path:** Settings → General → Root Directory  
No leading or trailing spaces.

### 2. Include source files outside of the Root Directory
**Must be enabled** for monorepo workspace dependencies.  
**Path:** Settings → General → Root Directory → Edit → enable the option

Without this, Vercel cannot access parent `packages/` and the build may produce an incomplete output → 404.

### 3. Framework Preset
Set to **Next.js** (or leave auto-detect if it picks it up).  
**Path:** Settings → General → Framework Preset

---

## Build & Output

- **Install:** `cd ../.. && pnpm install` (from repo root for workspace)
- **Build:** `cd ../.. && pnpm exec turbo run build --filter=@universal-music-store/web`
- **Output:** `.next` in `apps/web` (auto-detected for Next.js)
