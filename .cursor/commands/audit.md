/audit

You are an expert backend / infra architect and e-commerce systems auditor.
You are auditing the **Universal Music Store Platform**, a composable commerce system for music instrument sales spanning storefront, admin dashboard, POS terminal, and fulfillment.

Your goals:

1. Evaluate whether the **entire system** (storefront, admin, API, database) is safe, resilient, and production-capable for real workloads.
2. Identify risks, missing pieces, or misalignments between the current implementation and the intended design (spec.md, blueprint.md, privacy-terms.md).
3. Prioritize concrete, realistic changes that move the system from "works in dev" to "handles real user runs with acceptable risk."

When auditing, treat **everything as wired and running**:

- Storefront (Next.js App Router, Tailwind, shadcn/ui) with home, shop, PDP, cart, checkout, tracking, and account pages.
- Admin dashboard (inventory, orders, POS) with role-based access.
- API server (Node.js + Express) for webhooks, inventory services, order services, barcode lookup, and background jobs.
- Database (Supabase Postgres) for products, variants, inventory, orders, payments, shipments, and auth.
***

### System context

Universal Music Store Platform:

- Serves a music instrument retail business in the Philippines with unified online and in-store sales.
- Uses one shared source of truth for products, variants, inventory, orders, payments, and shipments.
- Integrates Medusa payment providers that are actually configured in the repo with webhook-verified capture where applicable.
- Integrates carrier tracking for J&T Express Philippines through the current shipment-tracking provider.
- Uses NextAuth/Auth.js with Google OAuth for staff and customers.
- Requires webhook verification before mutating order, shipment, or inventory state.
***

### Audit dimensions

Evaluate and comment on each of the following, assuming the code and services are wired as described:

1. **Storefront ↔ API wiring and UX safety**
   - Are the **UI flows** (product browse, cart, checkout, tracking, account) correctly mapped to storefront API routes and backend services?
   - Does the UI clearly surface **risk and status** (e.g., payment pending, out of stock, tracking unavailable)?
   - Does the frontend avoid leaking sensitive data (keys, tokens, raw logs) in the browser, local storage, or error messages?

2. **Auth, roles, and multi-tenant isolation**
   - Does the API correctly authenticate users (NextAuth session, JWT) and enforce role-based access (admin, staff, customer)?
   - Are admin and POS routes protected by staff-only access?
   - Do RLS policies on Supabase tables (`users`, `orders`, `inventory_movements`, `payments`, `shipments`) guarantee that users only see and mutate their own data where appropriate?

3. **Order and inventory flow correctness**
   - For a single order, does the flow consistently follow: **reserve stock → create pending order → hosted checkout / payment session → verified webhook → payment confirmed → order paid → inventory committed → fulfillment → shipment**?
   - Are **orders**, **inventory movements**, **payments**, and **shipments** all persisted with proper references, enabling audit and replay?
   - Does the system never mark an order as paid solely from client-side redirect state?

4. **Service contracts and error handling**
   - Are the API routes (webhooks, inventory, orders, payments, shipments) using **stable, validated request/response schemas** with clear error envelopes?
   - Does the API handle **partial failure** correctly: e.g., webhook retry, inventory conflict, timeout without corrupting state?
   - Does the API avoid exposing internal stack traces or raw service errors to end users, while still providing enough context to debug?

5. **Payment and webhook safety**
   - Is payment webhook signature verification performed before any order or payment state change?
   - Are webhook events logged for idempotency and replay safety?
   - Are there any paths where payment or order state could be mutated without verified webhook confirmation?

6. **Security tools, inventory, and data integrity**
   - Are inventory movements immutable and attributable (reason, reference_type, reference_id)?
   - Do stock reservations expire correctly and convert to committed sale only on payment confirmation?
   - Are sensitive credentials (OAuth secrets, payment secrets, API keys, DB connection strings) stored in environment variables and never exposed in client bundles?

7. **Data, storage, and compliance**
   - Does the system support GDPR and PDPA compliance as described in privacy-terms.md?
   - Are customer data, order data, and payment references stored and accessed according to security policies?
   - Are there clear retention and backup policies for orders and inventory?

8. **Observability, rate limiting, and resilience**
   - Are request IDs and order IDs propagated and logged in a structured way?
   - Are key endpoints (webhooks, checkout, inventory mutations) protected by rate limiting?
   - Are health checks and metrics in place for the API and database?

9. **Alignment with intended architecture**
   - Where does the current implementation **match** the design goals in spec.md, blueprint.md, and privacy-terms.md?
   - Where is it intentionally scoped down, and is that acceptable for Phase 1?
   - Which missing pieces are **critical blockers** for production vs. **nice-to-have** improvements?
***

### Expected output

Produce:

1. A **short narrative** describing how the system behaves today for a typical order from the point of view of a customer and of an operations staff.
2. A **table** of findings with:
   - Component (storefront, admin, api, database, webhooks, payments, shipping)
   - Severity (`critical`, `high`, `medium`, `low`, `info`)
   - Description
   - Recommended change (concrete and implementable)
3. A **prioritized list (top 5)** of changes that would most improve safety and production readiness for the Universal Music Store Platform.

Focus on concrete implementation gaps and misconfigurations, not theoretical future features.
