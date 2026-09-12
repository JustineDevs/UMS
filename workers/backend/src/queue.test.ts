import assert from "node:assert/strict";
import test from "node:test";
import {
  correlationIdFromJob,
  createCommerceJob,
  enqueueCommerceJob,
  handleCommerceJobBatch,
  handleCommerceJobMessage,
  type WorkerQueueMessage,
} from "./queue.ts";

test("accepts payment reconciliation jobs with a canonical correlation id", () => {
  const correlationId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(
    correlationIdFromJob({
      id: "job-1",
      name: "payment-reconciliation",
      payload: { correlationId },
      attempt: 0,
      createdAt: new Date().toISOString(),
    }),
    correlationId,
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
    "payment-reconciliation",
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

test("acknowledges malformed messages without invoking the handler", async () => {
  let acknowledged = 0;
  let handled = 0;
  await handleCommerceJobMessage(
    {
      body: {},
      id: "m-1",
      attempts: 1,
      ack: () => {
        acknowledged += 1;
      },
      retry: () => {
        throw new Error("must not retry");
      },
    },
    async () => {
      handled += 1;
    },
  );
  assert.equal(acknowledged, 1);
  assert.equal(handled, 0);
});

test("acknowledges queue jobs with unknown names, invalid attempts, or invalid timestamps", async () => {
  let acknowledged = 0;
  let handled = 0;
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
          throw new Error("must not retry invalid jobs");
        },
      },
      async () => {
        handled += 1;
      },
    );
  }
  assert.equal(acknowledged, 3);
  assert.equal(handled, 0);
});

test("retries transient failures and dead-letters after the attempt limit", async () => {
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
      retry: () => {
        throw new Error("must not retry");
      },
    },
    async () => {
      throw new Error("permanent");
    },
  );
  assert.equal(retries, 4);
  assert.equal(acknowledged, 1);
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

test("rejects oversized payloads before enqueueing", () => {
  assert.throws(
    () =>
      createCommerceJob("notification-delivery", {
        value: "x".repeat(128 * 1024),
      }),
    /payload_too_large/,
  );
});
