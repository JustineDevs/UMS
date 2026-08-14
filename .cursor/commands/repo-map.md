# /repo-map

Current repository structure and reference. Use this to orient agents and contributors.

## Current structure

- **Repo root** – Monorepo (Turborepo + pnpm): `package.json`, `pnpm-workspace.yaml`, `turbo.json`
  - **apps/** – Applications
    - `storefront/` – Next.js App Router. Public customer storefront (home, shop, PDP, cart, checkout, tracking, account).
    - `admin/` – Next.js App Router. Internal dashboard (analytics, inventory, orders, POS).
    - `api/` – Node.js + Express. Health (`/health`), compliance (`/compliance`, internal API key).
    - `medusa/` – Medusa 2 commerce backend (cart, orders, payments, webhooks).

  - **packages/** – Shared packages
    - `types/` – Shared domain types (Product, variants, images).
    - `validation/` – Zod schemas (shop query params, order status, roles).
    - `rate-limits/` – Env-driven rate-limit presets (used by `apps/api`).
    - `database/` – Supabase legacy, compliance queries, OAuth upsert, migration scripts.
    - `config/` – TypeScript, ESLint, Tailwind configuration.
    - `sdk/` – Medusa env helpers and shared constants.

- **docs/** – Internal documentation
  - `spec.md` – Universal Music Store Platform specification.
  - `blueprint.md` – Sprint plan and technical blueprint.
  - `privacy-terms.md` – PRD, service agreement, GDPR/PDPA compliance.

- **.cursor/** – Agent rules, commands, skills, LLM context
  - `commands/` – Cursor commands (audit, docs, hardening, QA, repo-map, trace, etc.).
  - `rules/` – Project rules and standards.
  - `llm/` – LLM context and indexed docs (payments, shipment tracking, etc.).

- **.github/** – Workflows, issue/PR templates (if present)

## Reference

Canonical spec and blueprint: see **docs/spec.md** and **docs/spec.md** for system scope, tech stack, data model, OMS flow, and sprint plan.

## Ownership

Review and sign-off are defined in **CODEOWNERS** (people/roles). Path-based auto-review can be added there if needed (e.g. `apps/*`, `packages/*`, `.cursor/*`).
