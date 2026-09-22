import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { handleAdminReviewsRequest } from "./reviews-admin.ts";

function token(): string { const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url"); const h = enc({ alg: "HS256", typ: "JWT" }); const p = enc({ sub: "staff_1", role: "admin", exp: Math.floor(Date.now() / 1000) + 300 }); return `${h}.${p}.${createHmac("sha256", "admin-secret").update(`${h}.${p}`).digest("base64url")}`; }

test("admin reviews are permission-gated, projected, and bounded", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = { query: async (text: string, values: readonly unknown[] = []) => { queries.push({ text, values }); return { rows: [{ id: "review-1", product_slug: "guitar", medusa_product_id: "prod-1", rating: 5, author_name: "A", body: "Great", status: "pending", created_at: "2026-09-21T00:00:00.000Z", customer_email: null, medusa_customer_id: null, verified_medusa_order_id: null, moderated_by_staff_email: null, is_verified_buyer: false, risk_score: 0, shadow_banned: false, moderated_at: null, moderation_note: null, open_report_count: 0 }], rowCount: 1 }; }, end: async () => {} };
  const response = await handleAdminReviewsRequest(new Request("https://api.test/api/admin/reviews?status=pending&limit=10", { headers: { Authorization: `Bearer ${token()}` } }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret" });
  assert.equal(response.status, 200); assert.equal((await response.json()).reviews[0].id, "review-1"); assert.deepEqual(queries[0]?.values, ["pending", 10]); assert.match(queries[0]?.text ?? "", /LIMIT \$2/); assert.doesNotMatch(queries[0]?.text ?? "", /SELECT \*/);
});

test("admin review moderation is bounded, replayable, and audited in the Worker", async () => {
  const queries: string[] = [];
  const database = { query: async (text: string) => { queries.push(text); return { rows: [{ id: "review-1", status: "approved" }], rowCount: 1 }; }, end: async () => {} };
  const response = await handleAdminReviewsRequest(new Request("https://api.test/api/admin/reviews/review-1", { method: "PATCH", headers: { Authorization: `Bearer ${token()}`, "Idempotency-Key": "review-key" }, body: JSON.stringify({ status: "approved", moderation_note: "checked", expected_updated_at: "2026-09-21T00:00:00.000Z" }) }), database, { CMS_ADMIN_JWT_SECRET: "admin-secret", reviewId: "review-1" });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, review: { id: "review-1", status: "approved" } }); assert.ok(queries.some((query) => query.includes("UPDATE public.product_reviews"))); assert.ok(queries.some((query) => query.includes("INSERT INTO public.audit_logs")));
});
