import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleReviewMutationRequest } from "./review-mutations.ts";

const secret = "jwt-secret";
const csrfSecret = "csrf-secret";
const reviewId = "11111111-1111-4111-8111-111111111111";

function token(claims: Record<string, unknown> = { sub: "customer-1", email: "user@example.com", exp: Math.floor(Date.now() / 1000) + 3600 }) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`;
}

function csrf() {
  const payload = `${Date.now()}.nonce`;
  return `${payload}.${createHmac("sha256", csrfSecret).update(payload).digest("base64url")}`;
}

function database(mode: "vote" | "report") {
  const statements: string[] = [];
  return {
    statements,
    query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
      statements.push(`${text}|${JSON.stringify(values)}`);
      if (text.startsWith("SELECT id FROM public.product_reviews")) return { rows: [{ id: reviewId }], rowCount: 1 } as { rows: T[]; rowCount: number };
      if (text.includes("SELECT EXISTS")) return { rows: mode === "vote" ? [{ inserted: true, helpful_votes: 4 }] : [], rowCount: 1 } as { rows: T[]; rowCount: number };
      if (text.includes("COUNT(*)")) return { rows: [{ count: 3 }], rowCount: 1 } as { rows: T[]; rowCount: number };
      return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    },
    end: async () => {},
  };
}

test("review helpful mutation verifies CSRF and writes an atomic vote", async () => {
  const csrfToken = csrf();
  const db = database("vote");
  const response = await handleReviewMutationRequest(new Request(`https://worker.test/store/reviews/${reviewId}/helpful`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, Cookie: `review_csrf=${csrfToken}`, "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.4" },
    body: JSON.stringify({ csrfToken }),
  }), db, { secret, AUTH_SECRET: csrfSecret }, "helpful", reviewId);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, helpful_votes: 4 });
  assert.ok(db.statements.some((statement) => statement.includes("ON CONFLICT DO NOTHING") && statement.includes("helpful_votes")));
});

test("review report requires an authenticated email and hides after the threshold", async () => {
  const csrfToken = csrf();
  const db = database("report");
  const response = await handleReviewMutationRequest(new Request(`https://worker.test/store/reviews/${reviewId}/report`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, Cookie: `review_csrf=${csrfToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ csrfToken, reason: "spam", details: "duplicate" }),
  }), db, { secret, AUTH_SECRET: csrfSecret }, "report", reviewId);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, open_report_count: 3 });
  assert.ok(db.statements.some((statement) => statement.includes("status='hidden'")));
});

test("review report rejects missing authentication and invalid CSRF", async () => {
  const db = database("report");
  const missingAuth = await handleReviewMutationRequest(new Request(`https://worker.test/store/reviews/${reviewId}/report`, { method: "POST", body: JSON.stringify({ csrfToken: "bad", reason: "spam" }) }), db, { secret, AUTH_SECRET: csrfSecret }, "report", reviewId);
  assert.equal(missingAuth.status, 403);
  const invalidCsrf = await handleReviewMutationRequest(new Request(`https://worker.test/store/reviews/${reviewId}/helpful`, { method: "POST", headers: { Authorization: `Bearer ${token()}`, Cookie: "review_csrf=bad" }, body: JSON.stringify({ csrfToken: "bad" }) }), db, { secret, AUTH_SECRET: csrfSecret }, "helpful", reviewId);
  assert.equal(invalidCsrf.status, 403);
});
