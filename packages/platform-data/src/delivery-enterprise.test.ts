import assert from "node:assert/strict";
import test from "node:test";
import { assertDeliveryGeofence, buildRoutingRequest, calculateDriverEarnings } from "./delivery-enterprise.js";

test("delivery enterprise controls enforce geofence and build OSRM requests", () => { assert.doesNotThrow(() => assertDeliveryGeofence({ latitude: 14.5995, longitude: 120.9842 }, { latitude: 14.5996, longitude: 120.9843 })); assert.equal(buildRoutingRequest([{ latitude: 14.6, longitude: 121 }]).coordinates, "121,14.6"); });
test("delivery enterprise controls calculate driver earnings", () => assert.equal(calculateDriverEarnings({ deliveryFee: 100, tip: 20, tolls: 10, commissionRate: 0.1 }), 100));
