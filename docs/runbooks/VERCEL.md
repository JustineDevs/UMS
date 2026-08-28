# Vercel Deployment (Storefront)

This runbook covers **only the Next.js storefront** on Vercel. Production also requires a reachable **Medusa** backend on Render, **Supabase** (for the payment ledger, staff RBAC, and related platform data), and scheduled calls to the storefront **payment recovery** cron route when using hosted checkout. See `docs/runbooks/PAYMENT-INTEGRATION.md` for the full payment lifecycle. The Render deployment contract is in `render.yaml`.

## Required Environment Variables

Set these in Vercel → Project → Settings → Environment Variables. Without them, the storefront shows "Catalog service unavailable" or "Invalid URL".

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_MEDUSA_URL` | Medusa backend base URL (HTTPS in production) | `https://universal-music-store-medusa.onrender.com` |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Medusa publishable API key | From `medusa seed:ph` output |
| `NEXT_PUBLIC_MEDUSA_REGION_ID` | Medusa region ID | From Medusa admin or seed |

Alternative: use `MEDUSA_BACKEND_URL`, `MEDUSA_PUBLISHABLE_API_KEY`, `MEDUSA_REGION_ID` (server-side only).

Do not leave these empty. Empty values cause "Invalid URL" errors.

---

## Node.js Version

The project requires Node 20. Set in Vercel: **Settings → General → Node.js Version → 20.x**.  
The storefront has `engines.node: "20.x"` and `.nvmrc`; Vercel should pick 20.x. If builds still use Node 24, set it explicitly in the dashboard.

Production storefront links should resolve to `https://universalmusic.vercel.app` unless a route-specific origin is documented elsewhere.

## Scheduled Operations

Vercel Hobby does not support the storefront's five-minute operational cadence. Production scheduled calls are made by `.github/workflows/storefront-cron.yml` every five minutes. Configure the repository secret `STOREFRONT_CRON_SECRET` with the same value as production Vercel `CRON_SECRET`. The workflow invokes payment finalization, campaign execution, payment reconciliation, and inventory reservation routes with a bearer token; each route remains fail-closed without it.

---

## Required Settings

### 1. Root Directory
```
apps/storefront
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
- **Build:** `cd ../.. && pnpm exec turbo run build --filter=@universal-music-store/storefront`
- **Output:** `.next` in `apps/storefront` (auto-detected for Next.js)
