import test from "node:test";
import assert from "node:assert/strict";
import { sendResendEmail } from "./resend.ts";

test("Resend transport sends bounded JSON with idempotency", async () => {
  let request: Request | undefined;
  const result = await sendResendEmail({ apiKey: "secret", from: "noreply@example.com", to: ["buyer@example.com"], subject: "Receipt", html: "<p>ok</p>", idempotencyKey: "receipt-1", fetchImpl: async (input, init) => { request = new Request(input, init); return new Response("{}", { status: 200 }); } });
  assert.deepEqual(result, { ok: true, status: 200 });
  assert.equal(request?.headers.get("Idempotency-Key"), "receipt-1");
  assert.equal(request?.headers.get("Authorization"), "Bearer secret");
});

test("Resend transport rejects oversized provider responses", async () => {
  const result = await sendResendEmail({ apiKey: "secret", from: "noreply@example.com", to: ["buyer@example.com"], subject: "Receipt", html: "<p>ok</p>", fetchImpl: async () => new Response("x".repeat(64 * 1024 + 1), { status: 200 }) });
  assert.deepEqual(result, { ok: false, status: 502 });
});
