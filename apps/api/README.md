# Express API (`@universal-music-store/api`)

Lightweight service: **health** (Medusa reachability) and **GDPR compliance** (Supabase-backed export and retention). Commerce (orders, payments, webhooks) runs in **Medusa**.

## Environment

Root **`.env.local`** (from `universal-music-store/.env.example`) supplies `INTERNAL_API_KEY`, `CORS_ORIGIN`, `MEDUSA_BACKEND_URL` (for health checks), and Supabase keys for compliance routes. Root **`.env.production`** mirrors the production-host values without localhost origins.

**Storefront URL (Vercel):** https://universalmusic.vercel.app — include this origin in `CORS_ORIGIN` when the API is called from the browser (rare; most calls are server-side).
