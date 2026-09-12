import assert from "node:assert/strict";
import test from "node:test";
import { persistWishlistMutation, wishlistSyncStorageKey } from "./wishlist";

test("wishlist mutations send only canonical product identity", async () => {
  const originalFetch = globalThis.fetch;
  let body = "";
  globalThis.fetch = async (_input, init) => {
    body = String(init?.body ?? "");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await persistWishlistMutation({
      slug: "canary",
      name: "stale client name",
      medusaProductId: "prod_stale",
    }, "add");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(JSON.parse(body), { medusaProductId: "prod_stale" });
});

test("wishlist sync completion is isolated per normalized account identity", () => {
  assert.notEqual(
    wishlistSyncStorageKey("Alice@example.com"),
    wishlistSyncStorageKey("bob@example.com"),
  );
  assert.equal(
    wishlistSyncStorageKey(" Alice@Example.com "),
    wishlistSyncStorageKey("alice@example.com"),
  );
});
