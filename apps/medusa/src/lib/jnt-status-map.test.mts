import assert from "node:assert/strict";
import jntStatusMap from "./jnt-status-map.ts";

const { mapJntStatus } = jntStatusMap;

assert.equal(mapJntStatus("SIGNED"), "delivered");
assert.equal(mapJntStatus("DELIVERED"), "delivered");
assert.equal(mapJntStatus("DELIVERING"), "out_for_delivery");
assert.equal(mapJntStatus("OUT_FOR_DELIVERY"), "out_for_delivery");
assert.equal(mapJntStatus("TRANSIT"), "in_transit");
assert.equal(mapJntStatus("IN_TRANSIT"), "in_transit");
assert.equal(mapJntStatus("ARRIVED"), "in_transit");
assert.equal(mapJntStatus("PENDING"), "pending");
assert.equal(mapJntStatus("CREATED"), "pending");
assert.equal(mapJntStatus("PICKED_UP"), "pending");
assert.equal(mapJntStatus("PROBLEM"), "exception");
assert.equal(mapJntStatus("EXCEPTION"), "exception");
assert.equal(mapJntStatus("RETURN"), "exception");
assert.equal(mapJntStatus("UNKNOWN_STATUS"), "in_transit");
assert.equal(mapJntStatus("some_random_value"), "in_transit");
assert.equal(mapJntStatus(undefined), "in_transit");
assert.equal(mapJntStatus(""), "in_transit");
assert.equal(mapJntStatus("signed"), "delivered");
assert.equal(mapJntStatus("delivering"), "out_for_delivery");
assert.equal(mapJntStatus("pending"), "pending");

console.log("[jnt-status-map] smoke passed");
