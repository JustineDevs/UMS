import assert from "node:assert/strict";
import test from "node:test";
import {
  appendDeliveryLogisticsEvent,
  listDeliveryLogisticsEvents,
  listDeliveryLogisticsShipments,
  upsertDeliveryLogisticsShipment,
} from "./delivery-logistics-ledger.js";

test("delivery logistics ledger exports functions without throwing", () => {
  assert.equal(typeof appendDeliveryLogisticsEvent, "function");
  assert.equal(typeof listDeliveryLogisticsEvents, "function");
  assert.equal(typeof listDeliveryLogisticsShipments, "function");
  assert.equal(typeof upsertDeliveryLogisticsShipment, "function");
});
