import test from "node:test";
import assert from "node:assert/strict";
import { handleBackInStockRequest, handleNewsletterRequest, handleNewsletterUnsubscribeRequest } from "./public-marketing.ts";
import { handleReviewListRequest } from "./reviews.ts";

const unusedDatabase = { query: async () => { throw new Error("database should not be touched"); }, end: async () => undefined };

test("public newsletter rejects malformed input before persistence", async () => {
  const response = await handleNewsletterRequest(
    new Request("https://worker/store/newsletter", { method: "POST", body: JSON.stringify({ email: "not-an-email" }) }),
    unusedDatabase,
    {},
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "valid_email_required" });
});

test("public unsubscribe rejects malformed input before persistence", async () => {
  const response = await handleNewsletterUnsubscribeRequest(
    new Request("https://worker/store/newsletter/unsubscribe", { method: "POST", body: JSON.stringify({ email: "" }) }),
    unusedDatabase,
    {},
  );
  assert.equal(response.status, 400);
});

test("back-in-stock rejects incomplete product identity before database work", async () => {
  const response = await handleBackInStockRequest(
    new Request("https://worker/store/back-in-stock", { method: "POST", body: JSON.stringify({ email: "shopper@example.com", productId: "" }) }),
    unusedDatabase,
    unusedDatabase,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_payload" });
});

test("review listing rejects missing product identity before querying", async () => {
  const response = await handleReviewListRequest(new Request("https://worker/store/reviews"), unusedDatabase);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "product_identity_required" });
});

test("review listing rejects malformed cursors before querying", async () => {
  const response = await handleReviewListRequest(new Request("https://worker/store/reviews?productSlug=guitar&cursor=bad"), unusedDatabase);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_review_cursor" });
});
