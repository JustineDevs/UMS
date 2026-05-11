/**
 * J&T status mapping unit tests. `.mts` keeps ESM resolution on Windows.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mapJntStatus } from "./jnt-status-map.js";

test("mapJntStatus: SIGNED maps to delivered", () => {
  assert.equal(mapJntStatus("SIGNED"), "delivered");
});

test("mapJntStatus: DELIVERED maps to delivered", () => {
  assert.equal(mapJntStatus("DELIVERED"), "delivered");
});

test("mapJntStatus: DELIVERING maps to out_for_delivery", () => {
  assert.equal(mapJntStatus("DELIVERING"), "out_for_delivery");
});

test("mapJntStatus: OUT_FOR_DELIVERY maps to out_for_delivery", () => {
  assert.equal(mapJntStatus("OUT_FOR_DELIVERY"), "out_for_delivery");
});

test("mapJntStatus: TRANSIT maps to in_transit", () => {
  assert.equal(mapJntStatus("TRANSIT"), "in_transit");
});

test("mapJntStatus: IN_TRANSIT maps to in_transit", () => {
  assert.equal(mapJntStatus("IN_TRANSIT"), "in_transit");
});

test("mapJntStatus: ARRIVED maps to in_transit", () => {
  assert.equal(mapJntStatus("ARRIVED"), "in_transit");
});

test("mapJntStatus: PENDING maps to pending", () => {
  assert.equal(mapJntStatus("PENDING"), "pending");
});

test("mapJntStatus: CREATED maps to pending", () => {
  assert.equal(mapJntStatus("CREATED"), "pending");
});

test("mapJntStatus: PICKED_UP maps to pending", () => {
  assert.equal(mapJntStatus("PICKED_UP"), "pending");
});

test("mapJntStatus: PROBLEM maps to exception", () => {
  assert.equal(mapJntStatus("PROBLEM"), "exception");
});

test("mapJntStatus: EXCEPTION maps to exception", () => {
  assert.equal(mapJntStatus("EXCEPTION"), "exception");
});

test("mapJntStatus: RETURN maps to exception", () => {
  assert.equal(mapJntStatus("RETURN"), "exception");
});

test("mapJntStatus: unknown status defaults to in_transit", () => {
  assert.equal(mapJntStatus("UNKNOWN_STATUS"), "in_transit");
  assert.equal(mapJntStatus("some_random_value"), "in_transit");
});

test("mapJntStatus: undefined defaults to in_transit", () => {
  assert.equal(mapJntStatus(undefined), "in_transit");
});

test("mapJntStatus: empty string defaults to in_transit", () => {
  assert.equal(mapJntStatus(""), "in_transit");
});

test("mapJntStatus: lowercase input still maps correctly", () => {
  assert.equal(mapJntStatus("signed"), "delivered");
  assert.equal(mapJntStatus("delivering"), "out_for_delivery");
  assert.equal(mapJntStatus("pending"), "pending");
});
