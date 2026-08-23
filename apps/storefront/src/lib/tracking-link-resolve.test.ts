import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrackingPath } from "./tracking-link-resolve";

test("tracking link POST resolution keeps the capability out of the entry query", () => {
  assert.equal(resolveTrackingPath("https://shop.test/track/cap_v3.token", "https://shop.test/track"), "/track/cap_v3.token");
  assert.equal(resolveTrackingPath("/track/cap_v3.token?leak=1", "https://shop.test/track"), null);
  assert.equal(resolveTrackingPath("/track/order_unsafe", "https://shop.test/track"), null);
});
