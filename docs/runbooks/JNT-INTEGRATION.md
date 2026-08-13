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

The repo uses a platform-first integration boundary:

- Medusa owns shipment lifecycle hooks and webhook mutation paths.
- Admin owns fulfillment entry, carrier selection, and export utilities.
- Storefront owns customer-facing tracking resolution and links.
- Shared packages own status mapping, env helpers, and validation.

### Medusa

Relevant files:

- [apps/medusa/src/lib/pancake-pos-client.ts](../../apps/medusa/src/lib/pancake-pos-client.ts)
- [apps/medusa/src/lib/jnt-status-map.ts](../../apps/medusa/src/lib/jnt-status-map.ts)
- [apps/medusa/src/api/hooks/jnt/route-logic.ts](../../apps/medusa/src/api/hooks/jnt/route-logic.ts)
- [apps/medusa/src/api/hooks/jnt/route.ts](../../apps/medusa/src/api/hooks/jnt/route.ts)
- [apps/medusa/src/subscribers/order-fulfillment-pancake-pos.ts](../../apps/medusa/src/subscribers/order-fulfillment-pancake-pos.ts)

Observed responsibilities:

- create the carrier order record after fulfillment creation through Pancake POS
- arrange shipment through Pancake POS after carrier order creation
- map carrier statuses into internal status vocabulary
- deduplicate webhook updates
- update Medusa order metadata and payment capture state

### Admin

Relevant files:

- [apps/admin/src/lib/courier-registry.ts](../../apps/admin/src/lib/courier-registry.ts)
- [apps/admin/src/app/api/medusa/shipments/route.ts](../../apps/admin/src/app/api/medusa/shipments/route.ts)
- [apps/admin/src/app/api/admin/orders/export-pancake-pos-csv/route.ts](../../apps/admin/src/app/api/admin/orders/export-pancake-pos-csv/route.ts)
- [apps/admin/src/app/api/admin/integration-health/route.ts](../../apps/admin/src/app/api/admin/integration-health/route.ts)

Observed responsibilities:

- expose a courier registry with `pancake-pos-jt-ph`
- persist shipment metadata on Medusa orders
- export Pancake POS bulk CSVs from Medusa order data
- report whether required Pancake POS env variables exist in the admin process

### Storefront

Relevant files:

- [apps/storefront/src/lib/medusa-track-fetch.ts](../../apps/storefront/src/lib/medusa-track-fetch.ts)

Observed responsibilities:

- derive customer tracking state from Medusa order metadata
- build carrier-specific tracking URLs
- show J&T tracking links when the courier slug matches the Pancake/J&T bridge variants

## Boundary Model We Should Keep

Use the carrier reference for contract shape, but keep business state in the platform:

1. Carrier client
   - Talks to Pancake POS.
   - Adds the api_key query authentication.
   - Returns raw carrier results.

2. Medusa shipment workflow
   - Owns fulfillment creation.
   - Owns webhook processing.
   - Owns payment capture side effects.

3. Admin operations layer
   - Selects courier.
   - Attaches tracking numbers.
   - Exports carrier-specific CSVs.

4. Storefront display layer
   - Renders carrier links.
   - Shows state derived from Medusa metadata.
   - Never mutates carrier or shipment state directly.

## Gaps Compared With the Reference

The reference sample is simple and direct. Our platform is safer, but there are still gaps:

- The reference has explicit create, arrange shipment, inquiry, and tracking URL examples. Our code now follows the documented Pancake order family, and we should not rely on a non-existent print endpoint.
- The reference keeps carrier state in a single imperative flow. Our platform spreads that across Medusa, admin, and storefront. That is correct, but it requires stronger contract docs.
- The reference sample shows direct polling. Our repo is mostly webhook-driven. That is better, but we still need explicit operational docs for fallback polling if webhook delivery fails.
- The reference uses carrier payloads as the immediate source of truth. Our system relies on Medusa metadata and Supabase event records as the source of truth, which is the right boundary.

## Current Verification State

Verified directly in the repo:

- J&T webhook parsing and signature verification succeed.
- J&T status mapping resolves `SIGNED -> delivered`.
- Delivered webhook events update order metadata and merge payment attempt payloads.
- COD capture runs once for delivered events when the payment is uncaptured.

## Recommended Next Work

If we extend J&T support, do it in this order:

1. Keep carrier I/O in `apps/medusa/src/lib/pancake-pos-client.ts`.
2. Keep webhook mutation logic in `apps/medusa/src/api/hooks/jnt/route-logic.ts`.
3. Keep admin shipment writes in the admin route that already patches Medusa order metadata.
4. Keep storefront tracking read-only.
5. Add an explicit cancel flow only if the business actually needs carrier-side cancellations.
6. Add fallback polling only if webhook delivery reliability is proven to be insufficient.
