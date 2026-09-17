# Partial fulfillments

Medusa represents fulfillment per order. An order can move to `partially_fulfilled` or `partially_shipped` when only some line items are packed or shipped.

## In Medusa Admin

Use the order detail workflow to create fulfillments that include a subset of line items and quantities. Subsequent fulfillments can cover remaining quantities until the order is fully fulfilled or canceled.

## In this monorepo

- **Staff admin** (`apps/web`): order and fulfillment UIs call Medusa admin APIs. Use the standard Medusa flow for multiple fulfillments per order.
- **Storefront**: customers see high-level status on the account and tracking pages. Detailed per-shipment line breakdowns are optional and depend on what you expose from Medusa in emails or tracking metadata.

## Returns

Returns apply to fulfilled quantities. The storefront exposes `POST /api/orders/return` and `/account/orders/[orderId]/return` for authenticated customers; staff still process refunds and logistics in admin per your policy.
