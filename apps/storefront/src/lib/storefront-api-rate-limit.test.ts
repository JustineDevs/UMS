import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseUpstashRestNumber,
  rateLimitFixedWindow,
} from "./storefront-api-rate-limit";

test("parseUpstashRestNumber accepts JSON result", () => {
  assert.equal(parseUpstashRestNumber('{"result":7}'), 7);
  assert.equal(parseUpstashRestNumber('{"result":-1}'), -1);
});

test("parseUpstashRestNumber accepts legacy plain number", () => {
  assert.equal(parseUpstashRestNumber("42"), 42);
});

test("fixed window allows up to max requests then rejects", async () => {
  const key = `burst-${Date.now()}-${Math.random()}`;
  const max = 25;
  const windowMs = 60_000;
  for (let i = 0; i < max; i++) {
    const r = await rateLimitFixedWindow(key, max, windowMs);
    assert.equal(r.ok, true);
  }
  const blocked = await rateLimitFixedWindow(key, max, windowMs);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.ok(blocked.retryAfterSec >= 1);
  }
});
