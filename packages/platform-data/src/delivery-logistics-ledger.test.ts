import assert from "node:assert/strict";
import test from "node:test";
import {
  appendDeliveryLogisticsEvent,
  listDeliveryLogisticsEvents,
  listDeliveryLogisticsShipments,
  upsertDeliveryLogisticsShipment,
  projectDeliveryStatus,
} from "./delivery-logistics-ledger.js";

test("delivery projection accepts return-to-sender and rejects skipped states", () => {
  assert.equal(projectDeliveryStatus("in_transit", "return-to-sender"), "returned");
  assert.equal(projectDeliveryStatus("in_transit", "dispatch"), "in_transit");
  assert.throws(() => projectDeliveryStatus("planned", "delivered"), /Invalid delivery transition/);
});

test("delivery logistics ledger exports functions without throwing", () => {
  assert.equal(typeof appendDeliveryLogisticsEvent, "function");
  assert.equal(typeof listDeliveryLogisticsEvents, "function");
  assert.equal(typeof listDeliveryLogisticsShipments, "function");
  assert.equal(typeof upsertDeliveryLogisticsShipment, "function");
});

test("delivery event append uses the atomic tenant-scoped RPC", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        data: {
          id: "event-1",
          shipment_id: "shipment-1",
          event_type: "carrier_update",
          event_status: "in_transit",
          event_payload: { provider: "jnt" },
          occurred_at: "2026-08-23T00:00:00.000Z",
          created_by_email: "staff@example.com",
          created_at: "2026-08-23T00:00:00.000Z",
        },
        error: null,
      };
    },
  } as never;

  const event = await appendDeliveryLogisticsEvent(client, {
    organization_id: "org-1",
    shipment_id: "shipment-1",
    event_type: "carrier_update",
    event_status: "in_transit",
    event_payload: { provider: "jnt" },
    created_by_email: "staff@example.com",
    idempotency_key: "evt-1",
  });

  assert.equal(event.id, "event-1");
  assert.equal(calls[0]?.name, "append_delivery_logistics_event");
  assert.equal(calls[0]?.args.p_organization_id, "org-1");
  assert.equal(calls[0]?.args.p_idempotency_key, "evt-1");
});
