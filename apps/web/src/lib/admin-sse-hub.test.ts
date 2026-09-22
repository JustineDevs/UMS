import assert from "node:assert/strict";
import test from "node:test";

import {
  getRegisteredSseClientCount,
  publishSseEvent,
  registerSseClient,
  unregisterSseClient,
} from "./admin-sse-hub";

test("SSE client unregister is idempotent", () => {
  const controller = { enqueue() {} } as ReadableStreamDefaultController;
  const initialCount = getRegisteredSseClientCount();
  const client = registerSseClient(controller, "staff@example.com");

  assert.equal(getRegisteredSseClientCount(), initialCount + 1);
  unregisterSseClient(client);
  unregisterSseClient(client);
  assert.equal(getRegisteredSseClientCount(), initialCount);
});

test("SSE publish evicts a client whose stream is already closed", () => {
  const payloads: Uint8Array[] = [];
  const healthy = registerSseClient({ enqueue(value?: Uint8Array) { if (value) payloads.push(value); } } as unknown as ReadableStreamDefaultController<Uint8Array>, "healthy");
  const broken = registerSseClient({ enqueue() { throw new Error("closed"); } } as unknown as ReadableStreamDefaultController<Uint8Array>, "broken");

  assert.equal(publishSseEvent("inventory.updated", { id: "inv-1" }), 1);
  assert.equal(payloads.length, 1);
  assert.equal(getRegisteredSseClientCount(), 1);
  unregisterSseClient(healthy);
  unregisterSseClient(broken);
});
