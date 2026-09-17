import assert from "node:assert/strict";
import test from "node:test";

import {
  getRegisteredSseClientCount,
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
