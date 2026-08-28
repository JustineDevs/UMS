import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedWishlistSyncUnauthorized, mergeWishlistSyncResult } from "./wishlist-sync-state";
import type { WishlistEntry } from "./wishlist";

test("treats an expired wishlist session as an expected signed-out state", () => {
  assert.equal(isExpectedWishlistSyncUnauthorized(401), true);
  assert.equal(isExpectedWishlistSyncUnauthorized(403), false);
  assert.equal(isExpectedWishlistSyncUnauthorized(503), false);
});

test("preserves local entries that were not canonicalized by the server", () => {
  const local: WishlistEntry[] = [
    { slug: "legacy", name: "Legacy item", addedAt: "2026-01-01T00:00:00.000Z" },
    { slug: "gone", name: "Unavailable item", medusaProductId: "prod_gone", addedAt: "2026-01-02T00:00:00.000Z" },
  ];

  const merged = mergeWishlistSyncResult(
    local,
    [{ slug: "guitar", name: "Guitar", medusaProductId: "prod_guitar", addedAt: "2026-01-03T00:00:00.000Z" }],
    ["prod_gone"],
  );

  assert.deepEqual(merged, [
    { slug: "guitar", name: "Guitar", medusaProductId: "prod_guitar", addedAt: "2026-01-03T00:00:00.000Z" },
    ...local,
  ]);
});

test("does not duplicate a local entry already returned canonically", () => {
  const local: WishlistEntry[] = [
    { slug: "old-guitar-handle", name: "Old Guitar", medusaProductId: "prod_guitar", addedAt: "2026-01-01T00:00:00.000Z" },
  ];

  assert.deepEqual(
    mergeWishlistSyncResult(
      local,
      [{ slug: "guitar", name: "Guitar", medusaProductId: "prod_guitar", addedAt: "2026-01-02T00:00:00.000Z" }],
      [],
    ),
    [{ slug: "guitar", name: "Guitar", medusaProductId: "prod_guitar", addedAt: "2026-01-02T00:00:00.000Z" }],
  );
});
