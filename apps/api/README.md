# Compliance API (`@universal-music-store/api`)

Lightweight service: **health** (Medusa reachability) and **GDPR compliance** (Supabase-backed export and retention). Commerce (orders, payments, webhooks) runs in **Medusa**.

## Environment

The legacy API package is retained for migration compatibility only. Production exposure is through the Worker-native backend in `workers/backend`; route handlers execute directly on Cloudflare Workers with Hyperdrive, Queues, and fetch/Web Crypto. Do not deploy this package as a separate API server or container.

**Storefront URL (Vercel):** https://universalmusic.vercel.app — include this origin in `CORS_ORIGIN` when the API is called from the browser (rare; most calls are server-side).
