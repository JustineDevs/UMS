import assert from "node:assert/strict";
import test from "node:test";
import {
  correlationIdFromJob,
  createCommerceJob,
  enqueueCommerceJob,
  handleCommerceJobBatch,
  handleCommerceJobMessage,
  isCommerceJob,
  type WorkerQueueMessage,
} from "./queue.ts";

test("rejects settlement reconciliation messages from the checkout-finalization queue", () => {
  const message = {
    id: "job-1",
    name: "payment-reconciliation",
    payload: { correlationId: "123e4567-e89b-42d3-a456-426614174000" },
    attempt: 0,
    createdAt: new Date().toISOString(),
  };
  assert.equal(isCommerceJob(message), false);
  assert.throws(
    () => correlationIdFromJob(message as unknown as Parameters<typeof correlationIdFromJob>[0]),
    /unsupported_commerce_job:payment-reconciliation/,
  );
});

test("isolates queue batch failures and retries only the failed message", async () => {
  const actions: string[] = [];
  const message = (id: string): WorkerQueueMessage => ({
    id,
    attempts: 1,
    body: { id, name: "notification-delivery", payload: {}, attempt: 1, createdAt: new Date().toISOString() },
    ack: () => actions.push(`ack:${id}`),
    retry: () => actions.push(`retry:${id}`),
  });
  await handleCommerceJobBatch([message("ok"), message("bad")], async (job) => {
    if (job.id === "bad") throw new Error("temporary");
  });
  assert.deepEqual(actions.sort(), ["ack:ok", "retry:bad"]);
});

test("creates and enqueues a bounded commerce job", async () => {
  const sent: unknown[] = [];
  const job = createCommerceJob(
    "webhook-finalization",
    { correlationId: "attempt-1" },
    "00000000-0000-4000-8000-000000000001",
  );
  await enqueueCommerceJob(
    {
      send: async (body) => {
        sent.push(body);
      },
    },
    job,
  );
  assert.deepEqual(sent, [job]);
  assert.equal(job.attempt, 0);
});

test("retries malformed messages when no dead-letter sink is available", async () => {
  let acknowledged = 0;
  let retryDelay = 0;
  let handled = 0;
  await handleCommerceJobMessage(
    {
      body: {},
      id: "m-1",
      attempts: 1,
      ack: () => {
        acknowledged += 1;
      },
      retry: (options) => {
        retryDelay = options?.delaySeconds ?? 0;
      },
    },
    async () => {
      handled += 1;
    },
  );
  assert.equal(acknowledged, 0);
  assert.equal(retryDelay, 300);
  assert.equal(handled, 0);
});

test("dead-letters unknown names, invalid attempts, and invalid timestamps", async () => {
  let acknowledged = 0;
  let handled = 0;
  const deadLetters: Array<{ id: string; error: string }> = [];
  for (const body of [
    { id: "m-unknown", name: "unknown", payload: {}, attempt: 0, createdAt: new Date().toISOString() },
    { id: "m-attempt", name: "webhook-finalization", payload: {}, attempt: 8, createdAt: new Date().toISOString() },
    { id: "m-date", name: "webhook-finalization", payload: {}, attempt: 0, createdAt: "invalid" },
  ]) {
    await handleCommerceJobMessage(
      {
        body,
        id: body.id,
        attempts: 1,
        ack: () => {
          acknowledged += 1;
        },
        retry: () => {
          throw new Error("must not retry a quarantined job");
        },
      },
      async () => {
        handled += 1;
      },
      async (message, error) => {
        deadLetters.push({ id: message.id, error: error instanceof Error ? error.message : "unknown" });
      },
    );
  }
  assert.equal(acknowledged, 3);
  assert.equal(handled, 0);
  assert.deepEqual(deadLetters, [
    { id: "m-unknown", error: "invalid_commerce_job" },
    { id: "m-attempt", error: "invalid_commerce_job" },
    { id: "m-date", error: "invalid_commerce_job" },
  ]);
});

test("does not acknowledge an invalid job when its dead-letter write fails", async () => {
  let acknowledged = 0;
  let retryDelay = 0;
  await handleCommerceJobMessage(
    {
      body: { invalid: true },
      id: "m-invalid-dlq-failure",
      attempts: 8,
      ack: () => { acknowledged += 1; },
      retry: (options) => { retryDelay = options?.delaySeconds ?? 0; },
    },
    async () => { throw new Error("must not process malformed job"); },
    async () => { throw new Error("dead-letter unavailable"); },
  );
  assert.equal(acknowledged, 0);
  assert.equal(retryDelay, 300);
});

test("retries transient failures and leaves terminal failures for the configured platform DLQ", async () => {
  let retries = 0;
  let acknowledged = 0;
  const job = createCommerceJob(
    "webhook-finalization",
    { eventId: "evt-1" },
    "00000000-0000-4000-8000-000000000002",
  );
  await handleCommerceJobMessage(
    {
      body: job,
      id: "m-2",
      attempts: 2,
      ack: () => {
        acknowledged += 1;
      },
      retry: (options) => {
        retries += options?.delaySeconds ?? 0;
      },
    },
    async () => {
      throw new Error("temporary");
    },
  );
  await handleCommerceJobMessage(
    {
      body: job,
      id: "m-3",
      attempts: 8,
      ack: () => {
        acknowledged += 1;
      },
      retry: (options) => {
        retries += options?.delaySeconds ?? 0;
      },
    },
    async () => {
      throw new Error("permanent");
    },
  );
  assert.equal(retries, 304);
  assert.equal(acknowledged, 0);
});

test("sends terminal failures to the explicit dead-letter sink before acknowledgement", async () => {
  const deadLetters: unknown[] = [];
  let acknowledged = 0;
  const job = createCommerceJob("webhook-finalization", { eventId: "evt-dead" }, "00000000-0000-4000-8000-000000000003");
  await handleCommerceJobMessage(
    {
      body: job,
      id: "message-dead",
      attempts: 8,
      ack: () => { acknowledged += 1; },
      retry: () => { throw new Error("must not retry terminal failures"); },
    },
    async () => { throw new Error("permanent"); },
    async (message, error) => { deadLetters.push({ id: message.id, error: error instanceof Error ? error.message : error }); },
  );
  assert.deepEqual(deadLetters, [{ id: "message-dead", error: "permanent" }]);
  assert.equal(acknowledged, 1);
});

test("does not acknowledge a terminal failure when the explicit dead-letter sink fails", async () => {
  let acknowledged = 0;
  let retryDelay = 0;
  const job = createCommerceJob("webhook-finalization", { eventId: "evt-dlq-failure" }, "00000000-0000-4000-8000-000000000004");

  await handleCommerceJobMessage(
    {
      body: job,
      id: "message-dlq-failure",
      attempts: 8,
      ack: () => { acknowledged += 1; },
      retry: (options) => { retryDelay = options?.delaySeconds ?? 0; },
    },
    async () => { throw new Error("permanent"); },
    async () => { throw new Error("dead-letter unavailable"); },
  );

  assert.equal(acknowledged, 0);
  assert.equal(retryDelay, 300);
});

test("rejects oversized payloads before enqueueing", () => {
  assert.throws(
    () =>
      createCommerceJob("notification-delivery", {
        value: "x".repeat(128 * 1024),
      }),
    /payload_too_large/,
  );
});
