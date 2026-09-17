import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_ENRICHMENT_CACHE_MAX_ENTRIES,
  createAuthEnrichmentCache,
} from "./auth";

test("auth enrichment cache lazily evicts expired entries", () => {
  const cache = createAuthEnrichmentCache({ maxEntries: 4, ttlMs: 10 });
  cache.set("expired", { role: "admin", permissions: ["*"] }, 100);
  cache.set("active", { role: "staff", permissions: ["dashboard:read"] }, 105);

  assert.equal(cache.get("expired", 110), undefined);
  assert.deepEqual(cache.get("active", 110), {
    role: "staff",
    permissions: ["dashboard:read"],
  });
  assert.equal(cache.size(110), 1);
});

test("auth enrichment cache evicts the least recently used entry at capacity", () => {
  const cache = createAuthEnrichmentCache({ maxEntries: 2, ttlMs: 1_000 });
  cache.set("first", { role: "staff", permissions: [] }, 0);
  cache.set("second", { role: "staff", permissions: [] }, 0);
  assert.deepEqual(cache.get("first", 1), { role: "staff", permissions: [] });

  cache.set("third", { role: "admin", permissions: ["*"] }, 2);

  assert.equal(cache.get("second", 2), undefined);
  assert.deepEqual(cache.get("first", 2), { role: "staff", permissions: [] });
  assert.deepEqual(cache.get("third", 2), { role: "admin", permissions: ["*"] });
  assert.equal(cache.size(2), 2);
});

test("default auth enrichment cache remains bounded at its production capacity", () => {
  const cache = createAuthEnrichmentCache();
  for (let index = 0; index <= AUTH_ENRICHMENT_CACHE_MAX_ENTRIES; index += 1) {
    cache.set(`user-${index}`, { role: "staff", permissions: [] }, 0);
  }

  assert.equal(cache.size(1), AUTH_ENRICHMENT_CACHE_MAX_ENTRIES);
});
