# ADR Plan PH-06 — FulfillmentPanel and shipment tracking

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Checklist #** | 6 |
| **Tier** | T2 High |

## Context

`apps/admin/src/components/FulfillmentPanel.tsx` supports staff shipping workflows. Partial fulfillment is documented in `docs/partial-fulfillment.md`. Shipment tracking hooks exist in Medusa; admin UI must call correct Medusa Admin APIs.

## Decision (target state)

Staff can create fulfillments with selected lines and quantities; tracking numbers register when the tracking provider is configured; errors surface from Medusa, not swallowed.

## Concrete plan

1. Trace fulfillment POST from panel to `medusaAdminFetch` or workflow client.
2. Add partial selection state synced to Medusa fulfillment item payload.
3. Integration test: mock Medusa admin responses for fulfillment create.
4. Document carrier and tracking validation rules in admin toast copy.

## Acceptance criteria

- Second fulfillment allowed for remaining quantity on same order.
- Tracking provider failure does not mark fulfillment created in UI unless Medusa succeeded.

## Rollback

Hide partial UI; fall back to full-ship only via Medusa admin native UI (operational workaround).
