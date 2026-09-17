import assert from "node:assert/strict";
import test from "node:test";

import { createInventoryStream } from "@/lib/admin-inventory-stream";

test("inventory stream installs abort cleanup before initial fetch resolves", async () => {
  const abortController = new AbortController();
  let resolveFetch!: () => void;
  const fetchStarted = new Promise<void>((resolve) => {
    resolveFetch = () => {
      resolve();
    };
  });
  let fetchCalls = 0;

  const stream = createInventoryStream(
    new Request("http://localhost/api/admin/inventory/stream", { signal: abortController.signal }),
    {
      page: 1,
      pageSize: 25,
      offset: 0,
      fetchPage: async () => {
        fetchCalls += 1;
        await fetchStarted;
        return { rows: [], total: 0 };
      },
    },
  );
  const reader = stream.getReader();

  await Promise.resolve();
  assert.equal(fetchCalls, 1);
  abortController.abort();
  const closed = await reader.read();
  assert.equal(closed.done, true);

  resolveFetch();
  await Promise.resolve();
  assert.equal(fetchCalls, 1);
});

test("inventory stream stops polling when its reader cancels", async () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let intervalHandle: ReturnType<typeof setInterval> | undefined;
  let clearCalls = 0;
  globalThis.setInterval = (() => {
    intervalHandle = {} as ReturnType<typeof setInterval>;
    return intervalHandle;
  }) as unknown as typeof setInterval;
  globalThis.clearInterval = ((handle) => {
    if (handle === intervalHandle) clearCalls += 1;
  }) as typeof clearInterval;

  let fetchCalls = 0;
  try {
    const stream = createInventoryStream(new Request("http://localhost/api/admin/inventory/stream"), {
      page: 1,
      pageSize: 25,
      offset: 0,
      fetchPage: async () => {
        fetchCalls += 1;
        return { rows: [], total: 0 };
      },
    });
    const reader = stream.getReader();

    const first = await reader.read();
    assert.equal(first.done, false);
    assert.match(new TextDecoder().decode(first.value), /"rows":\[\]/);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(intervalHandle);
    await reader.cancel();

    assert.equal(fetchCalls, 1);
    assert.equal(clearCalls, 1);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});
