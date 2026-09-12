<div align="center">
  <img src="./public/UVS/UVS_logo_landscape.png" alt="UNIVERSAL MUSIC STORE" width="800" />
</div>

# Universal Music Store

A Worker-native music commerce monorepo built with Turborepo, pnpm workspaces, Next.js 15, Cloudflare Workers, and Supabase-backed platform data.

## Overview

- Storefront: product discovery, cart, checkout, tracking, and customer account
- Admin dashboard: catalog, orders, POS, fulfillment, CMS, and staff workflows
- Medusa: commerce source of truth for products, carts, orders, payments, and inventory
- Supabase: staff identity, RBAC, CMS, loyalty, campaigns, and operational tables

## Tech Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Frontend | Next.js App Router, Tailwind CSS, shadcn/ui |
| API      | Cloudflare Workers + Wrangler               |
| Database | PostgreSQL via Supabase + Medusa Postgres   |
| Monorepo | Turborepo + pnpm workspaces                 |
| Auth     | Supabase Auth SSR with Google provider     |
| Payments | Stripe, PayPal, Xendit, COD                 |
| Shipping | Shipment tracking + J&T Express Philippines |

## Live Preview

**Storefront (Vercel):** https://universalmusic.vercel.app — see [docs/runbooks/VERCEL.md](docs/runbooks/VERCEL.md)  
**Backend (Cloudflare):** deployment is defined in [wrangler.jsonc](wrangler.jsonc). Worker-native route handlers use Hyperdrive for PostgreSQL, Queues for durable work, and fetch/Web Crypto for provider integrations. No container or external backend host is required.

## Project Structure

```text
apps/
├── storefront/   # Public customer storefront
├── admin/        # Dashboard, POS, fulfillment
├── api/          # Express health + compliance APIs
└── medusa/       # Medusa 2 commerce backend
packages/
├── database/     # Legacy Supabase schema, migrations, seeds
├── rate-limits/  # Shared rate-limit policies
├── sdk/          # Shared env helpers and constants
├── types/        # Shared domain types
├── ui/           # Shared UI primitives
└── validation/   # Shared validation schemas
docs/             # Specs, runbooks, ADRs, privacy/terms
stress-test/      # E2E, release-gate, runtime helpers, and dev orchestration scripts
```

## Development

### Prerequisites

- Node 20.x
- pnpm 10.x
- Wrangler and a Cloudflare account with Hyperdrive and Queues configured
- A Supabase project for the legacy/platform schema
- A Postgres database for Medusa
- A root `.env.local` for development and a root `.env.production` for production-mode parity

### Install

```bash
pnpm install
```

### Environment

Copy `.env.example` to `.env.local`, then fill the required local-development values. For production-mode local runs and production-host parity, mirror the same keys into `.env.production` without any localhost origins:

- `MEDUSA_DB_URL`
- `APP_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_MEDUSA_URL`
- `MEDUSA_BACKEND_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `STORE_CORS`
- `ADMIN_CORS`
- `AUTH_CORS`
- `CORS_ORIGIN`

`NODE_ENV` must stay `development` in the local repo `.env.local`. Use `.env.production` for production host parity, and set `NODE_ENV=production` only in real deployment environment variables on Cloudflare Workers or Vercel.

The Next.js apps load the root env through `scripts/load-monorepo-root-env.cjs`, which intentionally skips `NODE_ENV` so `next dev` and `next build` keep their own mode handling. Supabase Auth callback URLs are configured in the Supabase project and use each app's `/api/auth/callback` route.

`pnpm dev` runs the Worker-native backend and the storefront/admin apps on the host. Configure local Hyperdrive-compatible database URLs in `.env.local`; Docker is not part of the backend runtime.

### Database Setup

```bash
pnpm db:migrate
pnpm --filter medusa exec medusa db:migrate
```

Run `pnpm db:seed` or `pnpm --filter medusa seed:ph` only when you need sample or baseline data.

### Startup Sequence

```bash
pnpm dev
```

## Documentation

- [docs/runbooks/GUIDE.md](docs/runbooks/GUIDE.md) — provider credential runbook
- [wrangler.jsonc](wrangler.jsonc) — Cloudflare Workers and Container backend configuration
- [docs/runbooks/VERCEL.md](docs/runbooks/VERCEL.md) — Vercel-specific deployment notes
- [docs/runbooks/PAYMENT-INTEGRATION.md](docs/runbooks/PAYMENT-INTEGRATION.md) — payment provider setup
- [docs/spec.md](docs/spec.md) — system scope and functional requirements
- [docs/validation-truth-matrix.md](docs/validation-truth-matrix.md) — verification matrix and audit commands
- [docs/privacy-terms.md](docs/privacy-terms.md) — privacy, compliance, and terms

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security practices.

## License

Copyright (c) 2026 @JustineDevs. All rights reserved. Proprietary and confidential.
