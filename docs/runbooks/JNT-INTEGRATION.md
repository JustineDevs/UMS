# Pancake POS Logistics Bridge Map

This runbook records the current Pancake POS bridge pattern in the repo and the shape we should preserve going forward.

## Reference Pattern

The external reference in the companion Basiq project under `.internal/reference/J&T` is a direct carrier client:

- `Create_api.cs` builds a carrier payload, signs it, posts it, then persists order state.
- `Track_api.cs` polls the carrier tracking endpoint and writes scan events locally.
- `Cancel_api.cs` cancels a carrier order and restores inventory / order state.
- `jtexpress.js` shows the same idea in a smaller JS client: build body, sign, POST, read result.

The official Pancake POS API docs entry point is `https://docs.pancake.biz/pos/api/#tag/webhook`.
The rendered OpenAPI spec for Pancake POS exposes these order endpoints:

- `GET /shops`
- `GET /shops/{SHOP_ID}/orders`
- `GET /shops/{SHOP_ID}/orders/{ORDER_ID}`
- `POST /shops/{SHOP_ID}/orders`
- `POST /shops/{SHOP_ID}/orders/arrange_shipment`
- `POST /shops/{SHOP_ID}/orders/get_tracking_url`
- `GET /shops/{SHOP_ID}/orders_returned`

The webhook-related schemas in the spec describe payloads for orders, products, inventory, customers, and auto-call responses. The spec does not surface a standalone webhook callback path in the same way it surfaces order and warehouse endpoints, so we should not invent one in code or docs.

## Current Repo Pattern

The Cloudflare Worker is the backend authority. The web application is a UI/API
gateway and does not call a Medusa service or a J&T API directly.

Relevant files:

- `workers/backend/src/delivery-admin.ts` owns tenant-scoped shipment ledger reads/writes.
- `workers/backend/src/router.ts` exposes `/api/admin/delivery-logistics/shipments`.
- `apps/web/src/app/api/admin/delivery-logistics/shipments/route.ts` forwards staff requests to the Worker.
- `apps/web/src/app/api/admin/orders/export-pancake-pos-csv/route.ts` exports from the Worker-owned order data.
- `apps/web/src/lib/courier-registry.ts` lists supported courier choices.
- `apps/web/src/app/(public)/track/[orderId]/page.tsx` renders customer tracking state via Worker data.

Pancake POS is the logistics integration bridge. Do not add J&T API credentials or
direct J&T network calls unless the product integration changes explicitly.

## Boundary Model We Should Keep

Use the carrier reference for contract shape, but keep business state in the platform:

1. Worker shipment ledger owns shipment and delivery status mutations.
2. Pancake POS owns the connected logistics bridge and provider-side tracking actions.
3. Admin calls the Worker to create/update shipment records and export supported files.
4. Storefront tracking is read-only and renders Worker-owned order/shipment state.

## Gaps Compared With the Reference

The reference sample is simple and direct. Our platform is safer, but there are still gaps:

- The reference has explicit create, arrange shipment, inquiry, and tracking URL examples. Our code now follows the documented Pancake order family, and we should not rely on a non-existent print endpoint.
- The reference keeps carrier state in a single imperative flow. Our platform separates the Worker ledger, admin controls, and storefront display.
- The reference sample shows direct polling. Our repo is mostly webhook-driven. That is better, but we still need explicit operational docs for fallback polling if webhook delivery fails.
- The reference uses carrier payloads as the immediate source of truth. Our system relies on Worker-owned commerce records and Supabase event records as the source of truth.

## Current Verification State

Verified directly in the repo:

- J&T webhook parsing and signature verification succeed.
- J&T status mapping resolves `SIGNED -> delivered`.
- Delivered webhook events update order metadata and merge payment attempt payloads.
- COD capture runs once for delivered events when the payment is uncaptured.

## Recommended Next Work

If we extend J&T support, do it in this order:

1. Keep provider callbacks and mutations in Worker routes.
2. Keep admin shipment writes in `workers/backend/src/delivery-admin.ts`.
4. Keep storefront tracking read-only.
5. Add an explicit cancel flow only if the business actually needs carrier-side cancellations.
6. Add fallback polling only if webhook delivery reliability is proven to be insufficient.
