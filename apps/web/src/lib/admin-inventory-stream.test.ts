import assert from "node:assert/strict";
import test from "node:test";
import { createInventoryStream, type InventoryPageFetcher } from "./admin-inventory-stream";

test("inventory stream aborts during initial fetch without publishing after close", async () => {
  const controller = new AbortController();
  type InventoryPage = Awaited<ReturnType<InventoryPageFetcher>>;
  let resolveFetch!: (_value: InventoryPage) => void;
  let calls = 0;
  const stream = createInventoryStream(new Request("https://app.example/api/admin/inventory/stream", { signal: controller.signal }), {
    page: 1,
    pageSize: 25,
    offset: 0,
    fetchPage: () => { calls += 1; return new Promise((resolve) => { resolveFetch = resolve; }); },
  });
  const reader = stream.getReader();
  await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();
  resolveFetch({ rows: [{ id: "late" } as unknown as InventoryPage["rows"][number]], total: 1 });
  const result = await reader.read();
  assert.equal(result.done, true);
  assert.equal(calls, 1);
  await reader.cancel();
});
