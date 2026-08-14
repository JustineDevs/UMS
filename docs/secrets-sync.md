# Syncing secrets with Doppler or Infisical

This repo reads configuration from process environment at runtime. Use a secrets manager to inject the same keys in every environment without committing values.

## Doppler

1. Create a project with configs `dev`, `staging`, `production`.
2. Import keys from `.env.example` and set real values per config.
3. Local: install the Doppler CLI and run `doppler run -- pnpm run dev` from the repo root, or sync a local `.env.local` with `doppler secrets download --no-file --format env > .env.local` when allowed by your policy.

## Infisical

1. Create a project and environments (e.g. `dev`, `prod`).
2. Add secrets matching `.env.example` names.
3. Local: use the Infisical CLI to inject env for a command, or export a scoped `.env.local` for development.

## Rules

- Never commit files that contain production secrets.
- Keep `NEXT_PUBLIC_*` limited to values safe for the browser. Server-only keys (`MEDUSA_SECRET_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, payment secrets) must not use the `NEXT_PUBLIC_` prefix.
- Align Vercel (or your host) environment variables with the same names as in `.env.example` so storefront, admin, Medusa, and the API share one contract.
