import assert from "node:assert/strict";
import test from "node:test";

import { hasRecentAuthentication } from "./recent-auth";

test("recent authentication accepts a current signed session timestamp", () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");
  assert.equal(
    hasRecentAuthentication({ authenticatedAt: Math.floor((now - 5 * 60_000) / 1000) }, now),
    true,
  );
});

test("recent authentication rejects missing, expired, and future timestamps", () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");
  assert.equal(hasRecentAuthentication(null, now), false);
  assert.equal(
    hasRecentAuthentication({ authenticatedAt: Math.floor((now - 31 * 60_000) / 1000) }, now),
    false,
  );
  assert.equal(
    hasRecentAuthentication({ authenticatedAt: Math.floor((now + 60_000) / 1000) }, now),
    false,
  );
});
