import assert from "node:assert/strict";
import test from "node:test";
import type { NextRequest } from "next/server";
import { handleCmsFormSubmissionRequest } from "./cms-form-route-handler.js";

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/forms/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

test("handleCmsFormSubmissionRequest uses the service client when available", async () => {
  const serviceClient = { kind: "service" } as const;
  const anonClient = { kind: "anon" } as const;
  let capturedClient: unknown = null;

  const res = await handleCmsFormSubmissionRequest(
    makeRequest({
      name: "Justine",
      email: "justine@example.com",
      subject: "Need help",
      message: "Hello team",
    }),
    "contact",
    {
      getIp: () => "127.0.0.1",
      rateLimit: async () => ({ ok: true }),
      createServiceSupabase: () => serviceClient as never,
      createAnonSupabase: () => anonClient as never,
      insertSubmission: async (client, input) => {
        capturedClient = client;
        assert.equal(input.form_key, "contact");
        assert.equal(input.payload.message, "Hello team");
        return "submission_1";
      },
      getSettings: async () => null,
      fetchImpl: async () => new Response(null, { status: 204 }),
      nowIso: () => "2026-08-01T00:00:00.000Z",
    },
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, id: "submission_1" });
  assert.equal(capturedClient, serviceClient);
});

test("handleCmsFormSubmissionRequest falls back to anon if service client is missing", async () => {
  let called = 0;
  const res = await handleCmsFormSubmissionRequest(
    makeRequest({
      name: "Customer",
      email: "customer@example.com",
      subject: "Question",
      message: "Need support",
    }),
    "contact",
    {
      getIp: () => "127.0.0.1",
      rateLimit: async () => ({ ok: true }),
      createServiceSupabase: () => null,
      createAnonSupabase: () => ({ kind: "anon" } as never),
      insertSubmission: async () => {
        called += 1;
        return "submission_2";
      },
      getSettings: async () => null,
      fetchImpl: async () => new Response(null, { status: 204 }),
      nowIso: () => "2026-08-01T00:00:00.000Z",
    },
  );

  assert.equal(called, 1);
  assert.equal(res.status, 200);
});

test("handleCmsFormSubmissionRequest rejects unknown forms", async () => {
  const res = await handleCmsFormSubmissionRequest(
    makeRequest({
      name: "Customer",
      email: "customer@example.com",
      subject: "Question",
      message: "Need support",
    }),
    "unknown",
    {
      getIp: () => "127.0.0.1",
      rateLimit: async () => ({ ok: true }),
      createServiceSupabase: () => null,
      createAnonSupabase: () => null,
      insertSubmission: async () => null,
      getSettings: async () => null,
      fetchImpl: async () => new Response(null, { status: 204 }),
      nowIso: () => "2026-08-01T00:00:00.000Z",
    },
  );

  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Unknown form" });
});

test("handleCmsFormSubmissionRequest durably records successful webhook delivery", async () => {
  const events: string[] = [];
  const res = await handleCmsFormSubmissionRequest(
    makeRequest({ name: "Customer", email: "customer@example.com", message: "Hello" }),
    "contact",
    {
      getIp: () => "127.0.0.1",
      rateLimit: async () => ({ ok: true }),
      createServiceSupabase: () => ({ kind: "service" } as never),
      createAnonSupabase: () => null,
      insertSubmission: async () => "submission_webhook",
      getSettings: async () => ({ webhook_url: "https://example.test/hook" } as never),
      recordDelivery: async (_client, input) => {
        events.push(`record:${input.kind}:${input.aggregateId}`);
        return true;
      },
      finishDelivery: async (_client, key, result) => {
        events.push(`finish:${key}:${result.status}`);
        return true;
      },
      fetchImpl: async () => new Response(null, { status: 204 }),
    },
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    ok: true,
    id: "submission_webhook",
    delivery: "recorded",
  });
  assert.deepEqual(events, [
    "record:public_form_webhook:submission_webhook",
    "finish:public_form_webhook:submission_webhook:sent",
  ]);
});

test("handleCmsFormSubmissionRequest records failed webhook delivery without losing submission", async () => {
  let finished: unknown;
  const res = await handleCmsFormSubmissionRequest(
    makeRequest({ name: "Customer", email: "customer@example.com", message: "Hello" }),
    "contact",
    {
      getIp: () => "127.0.0.1",
      rateLimit: async () => ({ ok: true }),
      createServiceSupabase: () => ({ kind: "service" } as never),
      createAnonSupabase: () => null,
      insertSubmission: async () => "submission_failed",
      getSettings: async () => ({ webhook_url: "https://example.test/hook" } as never),
      recordDelivery: async () => true,
      finishDelivery: async (_client, key, result) => {
        finished = { key, result };
        return true;
      },
      fetchImpl: async () => new Response(null, { status: 503 }),
    },
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, id: "submission_failed", delivery: "recorded" });
  assert.equal((finished as { result: { status: string } }).result.status, "failed");
});
