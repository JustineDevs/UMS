# Agent Instructions – Universal Music Store Platform

You are working on the **Universal Music Store Platform**, a composable commerce system for music retail across storefront, POS, and fulfillment. Use this file as your primary context when assisting with this codebase.

## Project Overview

- **Purpose**: Unified online and in-store sales for a music retail business in the Philippines.
- **Architecture**: Monorepo (Turborepo + pnpm) with one shared source of truth for products, variants, inventory, orders, payments, and shipments.
- **Apps**: `apps/storefront`, `apps/admin`, `apps/api`, `apps/medusa`.
- **Packages**: `types`, `validation`, `rate-limits`, `database`, `config`, `sdk`, `ui`, `platform-data`.

## Canonical Documentation

Read these first when answering questions about scope, flow, or requirements:

- **docs/spec.md** – System scope, tech stack, functional requirements, OMS flow.
- **docs/validation-truth-matrix.md** – Verification commands, audit surface, and validation expectations.
- **docs/privacy-terms.md** – PRD, service agreement, GDPR/PDPA compliance.
- **docs/runbooks/GUIDE.md** – Deployment and operational runbook.

If some of the above files are absent in your branch, use git history or restore from main before relying on them.

For doc context commands, use **docs/** and **.cursor/llm** as canonical roots (see `.cursor/commands/docs.md`).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js App Router, Tailwind CSS, shadcn/ui |
| API | Node.js + Express |
| Database | PostgreSQL via Supabase |
| Auth | NextAuth/Auth.js with Google provider |
| Payments | Stripe, PayPal, Paymongo (GCash), Maya, cash on delivery (Medusa) |
| Shipping | Shipment tracking + J&T Express Philippines |

## Critical Rules

1. **Payment truth**: Orders MUST NOT be marked as paid from client-side redirect alone. Rely on verified payment-provider webhooks and Medusa payment completion.
2. **Webhook verification**: Always verify webhook signatures before mutating order, payment, or inventory state.
3. **Inventory**: Use immutable inventory movements. No manual stock overwrites as the only source of truth.
4. **Secrets**: Store OAuth, payment, and API keys in environment variables. Never expose them in client bundles.
5. **Shared logic**: Put types, validation, and service adapters in `packages/*`; consume from apps.

## Code Standards

- Follow `.cursor/rules/rules.mdc` for clean code, naming, and structure.
- Use `function` over arrow functions for top-level functions.
- Prefer explicit return types for top-level functions.
- Avoid emoji in UI and codebase.
- Use professional layout, typography, and spacing in UI.

## Commands and Workflows

- **/audit** – Full system audit (storefront, admin, API, webhooks, payments).
- **/QA** – Comprehensive QA report (architecture, data, auth, order flow, SDKs).
- **/trace** – Map data flow from UI → API → Supabase; flag MOCK/TODO/STUB.
- **/hardening** – Production hardening with findings log and fix phase.
- **/docs** – Load context from `docs/` and `.cursor/llm`.

## Project Structure Reference

```
apps/
├── storefront   # Home, shop, PDP, cart, checkout, track, account
├── admin        # Dashboard, inventory, orders, POS
├── api          # Health, compliance (internal key)
└── medusa       # Commerce backend (Medusa 2)
packages/
├── types, validation, rate-limits, database, config, sdk
└── ui             # Shared shadcn-style primitives (@universal-music-store/ui)
```

## MCP (Model Context Protocol)

- **Stripe** – Payments, subscriptions, refunds, docs search. Use for Stripe card and related flows.
- **PayPal** – Orders, refunds, disputes, subscriptions. Use for PayPal flows.
- **Supabase** – Database, migrations, Edge Functions. See `mcp_supabase_*` tools.

Ensure Stripe and PayPal MCP servers are enabled in Cursor when working on payment integrations.

### UI and layout (see `.cursor/rules/mcp-ui-stack.mdc`)

| MCP | Use |
|-----|-----|
| **shadcn** | Registry and `add` commands; extend `packages/ui`. |
| **ui-layouts-mcp** | Layout and motion patterns; port into Tailwind + `@universal-music-store/ui`. |
| **gsap-master** | GSAP timelines and scroll patterns; align with storefront motion. |
| **tailwindcss-server** | Tailwind utilities and token consistency. |
| **socraticode** | Guided reasoning for refactors. |
| **mui-mcp**, **mantine**, **chakra-ui**, **heroui-react**, **daisyui-blueprint**, **kibo-ui** | **Reference only** for patterns; do not add as runtime deps without an ADR. |

Full rules, workflows, and anti-patterns: **`.cursor/rules/mcp-ui-stack.mdc`**.

## Skills (when relevant)

- **storefront-best-practices** – E-commerce storefronts, checkout, cart, product pages.
- **building-admin-dashboard-customizations** – Admin UI, widgets, forms, tables.
- **authentication-setup** – Login, JWT, OAuth, session, RBAC.
- **design-with-taste** – Simplicity, fluidity, delight in UI.
- **stripe-integration** (skills-lock) – Stripe setup and webhooks.
- **paypal-integration** (skills-lock) – PayPal setup and webhooks.
