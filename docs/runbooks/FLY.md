# Fly.io Deployment (Medusa Backend)

This runbook is the deployment contract for the Medusa commerce backend. The root `fly.toml` uses `Dockerfile.medusa`, exposes port `9000`, checks `/health`, and keeps one machine running in Singapore for checkout, admin traffic, and payment webhooks.

## Prerequisites

- Fly CLI (`flyctl`) installed and authenticated with `fly auth login`
- A production PostgreSQL database reachable from Fly.io
- Production values for `JWT_SECRET`, `COOKIE_SECRET`, CORS origins, and Supabase service credentials
- The storefront deployed separately on Vercel

## First deployment

```bash
fly apps create universal-music-store-medusa
fly secrets set \
  DATABASE_URL="..." \
  JWT_SECRET="..." \
  COOKIE_SECRET="..." \
  STORE_CORS="https://universalmusic.vercel.app" \
  ADMIN_CORS="https://admin.example.com" \
  AUTH_CORS="https://admin.example.com" \
  SUPABASE_URL="..." \
  SUPABASE_SERVICE_ROLE_KEY="..."
fly deploy --config fly.toml --remote-only
```

If the app name is unavailable, change `app` in `fly.toml` and use that same name in the commands.

## Verification

```bash
fly status --app universal-music-store-medusa
fly checks list --app universal-music-store-medusa
curl --fail --show-error --silent https://universal-music-store-medusa.fly.dev/health
```

The health endpoint must return HTTP 200. Do not use a path that redirects because Fly service checks do not follow HTTP redirects.

## Updates and rollback

```bash
fly deploy --config fly.toml --remote-only
fly releases --app universal-music-store-medusa
fly deploy --app universal-music-store-medusa --image <previous-image>
```

Run Medusa database migrations deliberately against the production database before or during a controlled release. Do not add an automatic migration command to the release configuration until the migration lock and rollback policy are approved.

## Runtime boundaries

- Fly.io: Medusa backend only
- Vercel: Next.js storefront, with `NEXT_PUBLIC_MEDUSA_URL` set to the Fly hostname
- Supabase/managed Postgres: persistent platform and commerce data
- Payment providers and Nango: external OAuth/payment infrastructure

The old Render blueprint was removed so it cannot create a second, conflicting production topology.
