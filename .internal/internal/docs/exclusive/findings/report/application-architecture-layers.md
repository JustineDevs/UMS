# Application architecture: layers and file separation

**Standalone snapshot.** Temporary report describing how the Universal Music Store monorepo splits responsibilities across apps, packages, and files. Generated for internal review; not linked to any automation or policy checklist.

**For export:** use **`runtime-logic-and-data-flow.md`** in this same folder. That companion doc explains **what runs**, **step-by-step data flow**, **payment and webhook logic in code**, and **sequence behavior**. This file stays structural; the companion file is the logic deep dive.

---

## 1. Executive view

The system is a **pnpm + Turborepo** workspace under `universal-music-store/`. Work splits into:

| Layer | Role | Primary locations |
|-------|------|-------------------|
| **Presentation** | UI, routing, browser state | `apps/storefront`, `apps/admin` |
| **BFF / edge API** | Server-only routes that call Medusa or hide secrets | `apps/admin/src/app/api/**`, `apps/storefront/src/app/api/**` |
| **Commerce engine** | Products, cart, checkout, orders, payments, inventory (Medusa 2.x) | `apps/medusa` |
| **Sidecar HTTP API** | Health, compliance, shared middleware (Express) | `apps/api` |
| **Shared libraries** | Types, env, DB access to legacy schema, validation | `packages/*` |

**Target system of record for commerce** (`internal/docs/adr/0001-medusa-system-of-record.md`): **Medusa** on a **dedicated Postgres**. Legacy **Supabase** schema (`packages/database`) supports **export migration** and any remaining read paths until cutover completes.

---

## 2. Monorepo map

```
universal-music-store/
├── apps/
│   ├── storefront/     # Next.js public shop
│   ├── admin/          # Next.js staff dashboard + POS API routes
│   ├── api/            # Express: minimal surface (health, compliance)
│   └── medusa/         # Medusa backend: modules, subscribers, webhooks
├── packages/
│   ├── types/          # Shared domain types
│   ├── validation/     # Zod (or similar) schemas
│   ├── database/       # Supabase client + SQL queries + migrations
│   ├── sdk/            # Medusa URL/keys, env assertions, public site URL
│   ├── rate-limits/    # Shared rate limit config for HTTP layers
│   ├── ui/             # Shared UI primitives
│   └── config/         # eslint, typescript, tailwind presets
├── e2e/                # Playwright (smoke)
└── pnpm-workspace.yaml # apps/* + packages/*
```

---

## 3. Layer-by-layer design

### 3.1 Presentation: storefront (`apps/storefront`)

**Responsibility:** Marketing pages, catalog browsing, PDP, cart (client), checkout handoff, tracking, account.

**Separation:**

- **`src/app/(public)/**`** — App Router pages and layouts. Data fetching and composition live here or in small server components.
- **`src/lib/`** — Integration logic, not visual components:
  - `medusa-sdk.ts`, `storefront-medusa-env.ts` — Medusa JS SDK and env wiring.
  - `catalog-fetch.ts`, `catalog-fetch-helpers.ts`, `medusa-catalog-mapper.ts` — Store API → domain `Product` types.
  - `medusa-checkout.ts` — Cart → payment session → Lemon checkout URL (browser).
  - `medusa-track-fetch.ts` — Order tracking against Medusa when configured.
  - `cart.ts`, `wishlist.ts`, `shop-url.ts` — Client persistence and URL helpers.
  - `medusa-sop-env.ts` — Operational checks aligned with shared SDK assertions.
- **`instrumentation.ts`** — Boot-time hooks (e.g. env validation imports).

**Rule of thumb:** Pages own layout and composition; `lib/` owns **how** to talk to Medusa and how to map responses. No order-of-record writes in the browser except through Medusa’s APIs.

### 3.2 Presentation: admin (`apps/admin`)

**Responsibility:** Staff UI, POS, order/fulfillment views.

**Separation:**

- **`src/app/(dashboard)/`** — Dashboard routes (inventory, orders, POS).
- **`src/app/api/**`** — **BFF** routes that run on the server only:
  - `api/auth/[...nextauth]` — NextAuth.
  - `api/medusa/**` — Proxies to Medusa Admin API (orders, shipments) using secret keys from env.
  - `api/pos/medusa/**` — POS flows: lookup, draft order, commit sale, quick products.

**Rule of thumb:** The browser never holds Medusa **secret** keys; only server routes use them.

### 3.3 Commerce engine: Medusa (`apps/medusa`)

**Responsibility:** Authoritative commerce domain after cutover: catalog, cart, payments, orders, inventory locations, fulfillments.

**Separation:**

- **`medusa-config.ts`** — Loads env, registers payment modules (Lemon, Stripe, PayPal, Paymongo, COD), validates production env via `src/loaders/validate-process-env.ts`.
- **`src/modules/*-payment/`** — Provider-specific payment modules (`lemonsqueezy-payment`, `paypal-payment`, `paymongo-payment`, `cod-payment`, plus Stripe package).
- **`src/subscribers/`** — Domain events (e.g. `order-placed-resend-email.ts`, `order-fulfillment-aftership.ts`).
- **`src/api/hooks/aftership/`** — HTTP webhook for carrier tracking (AfterShip).
- **`src/scripts/`** — Seed and **legacy JSONL import** for migration (`import-legacy-catalog-jsonl.ts`, `import-legacy-inventory-jsonl.ts`).
- **`src/api/store/custom`, `src/api/admin/custom`** — Extension points for custom API routes.

**Rule of thumb:** Payment capture and webhook idempotency live **here** for Medusa-owned traffic; Express does not duplicate that logic for the same provider in production once cutover is done.

### 3.4 Sidecar API: Express (`apps/api`)

**Current shape (this workspace):** `src/index.ts` mounts **global middleware** (request id, helmet, CORS, JSON parser) and routes:

- **`/health`** — Liveness/readiness style checks.
- **`/compliance`** — Internal/compliance endpoints behind `INTERNAL_API_KEY`.

**Supporting `lib/`:** `requestId.ts`, `requireInternalApiKey.ts`, `errorHandler.ts`, `securityEvent.ts`.

If earlier revisions of the repo exposed `/products`, `/checkout`, `/webhooks/*` on Express, treat that as **legacy or transitional**; the ADR and cutover docs (`internal/docs/exclusive/fixes/today/COMMERCE-CUTOVER-PROGRAM.md`) move **commerce** to Medusa.

### 3.5 Shared packages

| Package | Contents |
|---------|----------|
| **`packages/types`** | Shared TypeScript types for products, orders, etc. Used by storefront mappers and UI. |
| **`packages/validation`** | Request validation schemas shared where applicable. |
| **`packages/database`** | `src/queries/*` — Supabase/Postgres access for **legacy** flows (orders, inventory, webhooks, barcode, checkout). `supabase/migrations`, `seed.sql`. Scripts for **export to JSONL** for Medusa import. |
| **`packages/sdk`** | `medusa-env.ts` — Medusa base URL, publishable key, region, sales channel, payment provider id, secret key for server use. `env/medusa-storefront.ts`, `env/admin-medusa.ts` — production assertions. `public-site-url.ts` — default public origin for emails/links. |
| **`packages/rate-limits`** | Centralized numeric limits for HTTP layers (when used). |
| **`packages/ui`** | shared components (adoption varies by app). |
| **`packages/config/*`** | ESLint, TypeScript, Tailwind presets for consistent tooling. |

---

## 4. Request flows (high level)

**Customer catalog (Medusa-first):**  
Storefront page → `catalog-fetch.ts` → Medusa Store API (`@medusajs/js-sdk`) → `medusa-catalog-mapper.ts` → UI.

**Checkout:**  
`checkout/page.tsx` → `medusa-checkout.ts` → Medusa cart + payment session → redirect to Lemon (or other provider URL returned by provider).

**Staff POS (Medusa):**  
Admin POS UI → `POST /api/pos/medusa/lookup` (and related routes) → Medusa Admin API / workflows on server.

**Tracking:**  
Track page → `medusa-track-fetch.ts` (and related routes) → Medusa order/fulfillment data.

**Express:** Only health/compliance in the current tree unless you restore additional routers; not on the Medusa happy path.

---

## 5. Data and state (two databases, one purpose each)

1. **Medusa Postgres** (`DATABASE_URL` in Medusa env) — **Target** system of record for commerce after cutover.
2. **Legacy Supabase Postgres** (`packages/database`) — **Migration source** and legacy queries; **must not** be treated as the long-term home for new orders once Medusa owns writes.

**Cart persistence:** Storefront uses **browser storage** (`cart.ts`). The **paid** order is created in **Medusa** (and payment state comes from provider webhooks into Medusa).

---

## 6. Cross-cutting concerns (where they live)

| Concern | Where implemented |
|---------|-------------------|
| **Env validation** | Medusa `validate-process-env.ts`; storefront `instrumentation.ts` + `packages/sdk` env assertions; Express `INTERNAL_API_KEY` check at boot. |
| **Auth** | NextAuth in `apps/admin` (and storefront if configured). Medusa has its own admin/session auth. |
| **Rate limiting** | `packages/rate-limits` + any Express middleware (if extended). Medusa should be protected at gateway in production. |
| **Security logging** | `apps/api` `securityEvent.ts` when Express handles events. |
| **Email** | Resend from Medusa subscribers (e.g. `order-placed-resend-email.ts`). |

---

## 7. Code map vs runtime logic

**Do not stop at file names.** The companion document **`runtime-logic-and-data-flow.md`** explains:

- Which **processes** start and what runs at **boot** (Next `instrumentation`, Medusa `loadEnv` + Zod validation).
- **Catalog:** gate → SDK → `product.list` / category resolution → mapper to `Product` types, including misconfiguration vs service error.
- **Checkout:** numbered steps from `cart.create` through `initiatePaymentSession` to Lemon `checkout_url`.
- **Medusa Lemon module:** `initiatePayment` (Lemon REST checkout creation with `medusa_payment_session_id` embedded), `getWebhookActionAndData` (HMAC verify, dedup, `order_created` + paid, session id extraction), and why paid state is **not** client-driven.
- **Resend subscriber:** event → order retrieve → email with `/track/{order.id}`.
- **POS:** `requireStaffSession` → store/admin product search → `draftOrder` → `convertToOrder`.
- **Tracking:** `order.retrieve` vs `cart.retrieve` and how status is **derived** from payment and fulfillment fields.
- **Express:** current minimal routes and that commerce is **not** hosted there in this tree.

Below is a **compact** path index only for navigation; behavior detail is in the companion file.

| Area | Navigate here |
|------|-----------------|
| Storefront pages | `apps/storefront/src/app/(public)/` |
| Storefront Medusa integration | `apps/storefront/src/lib/catalog-fetch.ts`, `medusa-checkout.ts`, `medusa-track-fetch.ts`, `medusa-sdk.ts` |
| Storefront boot checks | `apps/storefront/instrumentation.ts`, `packages/sdk/src/env/medusa-storefront.ts` |
| Admin POS BFF | `apps/admin/src/app/api/pos/medusa/*/route.ts` |
| Medusa config + payments | `apps/medusa/medusa-config.ts`, `src/modules/lemonsqueezy-payment/service.ts`, `src/subscribers/order-placed-resend-email.ts` |
| Express sidecar | `apps/api/src/index.ts`, `routes/health.ts`, `routes/compliance.ts` |
| Shared env | `packages/sdk/src/medusa-env.ts`, `env/*.ts` |

---

## 8. What this report did not assume

- **Exact** deployment topology (Vercel, Docker, Fly, etc.): only that each app has its own process and env.
- **Full** RBAC matrix: admin protection depends on NextAuth + middleware; verify in code for each route.
- **Legacy Express routes** if they exist in another branch: the architecture intent is **Medusa as core**, Express **shrunk** to non-commerce utilities.

---

## 9. Suggested follow-ups (outside this report)

- Keep **one** diagram in `internal/docs/` that matches the **current** `apps/api` route list (update when Express changes).
- Add **integration tests** that start at Medusa + one payment provider and assert webhook idempotency.
- When cutover finishes, **delete** unused `packages/database` query paths and document **final** retention for legacy Supabase.

---

*End of standalone report.*
