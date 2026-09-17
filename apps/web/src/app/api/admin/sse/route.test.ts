import assert from "node:assert/strict";
import test from "node:test";

import { createAdminSseStream } from "@/lib/admin-sse-stream";
import { getRegisteredSseClientCount } from "../../../../lib/admin-sse-hub";

test("admin SSE removes its client when the reader cancels", async () => {
  const initialCount = getRegisteredSseClientCount();
  const stream = createAdminSseStream(new Request("http://localhost/api/admin/sse"), "staff@example.com");
  const reader = stream.getReader();

  const connected = await reader.read();
  assert.equal(connected.done, false);
  assert.match(new TextDecoder().decode(connected.value), /event: connected/);
  assert.equal(getRegisteredSseClientCount(), initialCount + 1);

  await reader.cancel();
  assert.equal(getRegisteredSseClientCount(), initialCount);
});

test("admin SSE removes its client when the request aborts", async () => {
  const initialCount = getRegisteredSseClientCount();
  const abortController = new AbortController();
  const stream = createAdminSseStream(
    new Request("http://localhost/api/admin/sse", { signal: abortController.signal }),
    "staff@example.com",
  );
  const reader = stream.getReader();

  await reader.read();
  assert.equal(getRegisteredSseClientCount(), initialCount + 1);
  abortController.abort();

  const closed = await reader.read();
  assert.equal(closed.done, true);
  assert.equal(getRegisteredSseClientCount(), initialCount);
});

test("admin SSE removes its client when initial controller work fails", async () => {
  const initialCount = getRegisteredSseClientCount();
  const stream = createAdminSseStream(
    new Request("http://localhost/api/admin/sse"),
    "staff@example.com",
    { beforeConnected: (controller) => controller.error(new Error("controller failed")) },
  );
  const reader = stream.getReader();

  await assert.rejects(reader.read(), /controller failed/);
  assert.equal(getRegisteredSseClientCount(), initialCount);
});
