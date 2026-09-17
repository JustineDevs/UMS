<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use GitHub Actions for scheduled storefront jobs; cron runs in UTC and invokes protected production URLs via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

## Branch and Deployment Topology

## Backend Hosting Architecture
- Vercel hosts the frontend.
- Cloudflare Workers (managed by Wrangler) are the complete backend runtime.
- The Worker-native route handlers are the commerce origin; do not add a Medusa runtime or container fallback.
- Supabase Cloud provides PostgreSQL; do not deploy Supabase inside the Worker.
- Upstash provides Redis; do not deploy Redis inside the Worker.
- The topology has exactly two PostgreSQL databases: `MEDUSA_DB_URL` is the
  Medusa commerce database (catalog, carts, orders, inventory, payments, and
  customers), while `APP_DB_URL` is the application/platform database (CMS,
  staff/RBAC, audit, and platform data). Do not introduce a third database or
  use a generic database-URL alias.
- Do not deploy the unified web application to the backend origin.
- Use the Cloudflare Worker deployment URL configured through `API_URL`; a custom DNS hostname is optional and is not a release prerequisite.
- Do not deploy Medusa, compliance, Render, Fly.io, ECS, or any external backend origin. All backend contracts must execute in the Worker with Hyperdrive, Queues, and fetch/Web Crypto.

- `dev` is the only development and integration branch; make all changes there.
- `dev` deploys to the preview environment at `https://universalmusic-preview.vercel.app`.
- `main` is production and deploys to `https://universalmusic.vercel.app`.
- Never make direct production changes or deploy production from a feature branch.
- Promote changes through a pull request from `dev` to `main` only after reviewing all CI results, PR comments, and findings.
- Fix every review or CI finding on `dev`, rerun the required checks, and merge only when the PR is verified clean.
- Vercel Cron is not part of this topology. Keep scheduled storefront recovery in `.github/workflows/storefront-cron.yml`; do not add a Vercel `crons` block or treat Vercel Hobby Cron limits as a payment-webhook solution.
- Deploy the backend only with `pnpm backend:worker:deploy` after `wrangler login` and configured Hyperdrive/Queue bindings. Docker is not part of the backend deployment path.
- Before pushing any branch, run the local Act gate with `pnpm ci:local`; a failed or skipped local gate must not be pushed.
- Local Act validates the non-secret release workflow. Provider sandbox, security, and production-only checks still require their documented credentials or infrastructure and must not be simulated with empty secrets.

<!-- CONTINUAL LEARNING -->
- Sprint and `/sprint` backlog: Treat the user's listed sprint items as mandatory commitments—they stay under Committed unless Blocked by a concrete, named external blocker; do not downgrade to optional/stretch, silently drop items, narrow acceptance criteria, or replace implementation work with docs or placeholders without explicit Product Owner approval.
- Payments: The codebase standardizes on Stripe plus PayPal; Lemon Squeezy was removed across Medusa, storefront, admin, and BYOK—do not re-add MoR PSP integration unless product direction explicitly changes again.
- TypeScript workspace resolution: keep workspace dependencies explicit so pnpm and `tsc` resolve shared packages consistently.
