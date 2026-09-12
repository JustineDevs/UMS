import assert from "node:assert/strict";
import test from "node:test";
import { fetchMedusaPages } from "./medusa-pagination";

test("fetches counted pages in bounded parallel batches", async () => {
  const offsets: number[] = [];
  const result = await fetchMedusaPages(
    2,
    async (offset) => {
      offsets.push(offset);
      return { rows: [offset, offset + 1], total: 8 };
    },
    2,
  );

  assert.equal(result.requestCount, 4);
  assert.deepEqual(offsets, [0, 2, 4, 6]);
  assert.deepEqual(result.pages.flat(), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("keeps unknown-count APIs sequential and exact", async () => {
  const offsets: number[] = [];
  const result = await fetchMedusaPages(
    2,
    async (offset) => {
      offsets.push(offset);
      return { rows: offset < 4 ? [offset, offset + 1] : [offset] };
    },
    4,
  );

  assert.equal(result.requestCount, 3);
  assert.deepEqual(offsets, [0, 2, 4]);
  assert.deepEqual(result.pages.flat(), [0, 1, 2, 3, 4]);
});

test("honors an authoritative total when a page is shorter than requested", async () => {
  const offsets: number[] = [];
  const result = await fetchMedusaPages(
    4,
    async (offset) => {
      offsets.push(offset);
      return { rows: [offset], total: 10 };
    },
    2,
  );

  assert.deepEqual(offsets, [0, 4, 8]);
  assert.deepEqual(result.pages.flat(), [0, 4, 8]);
});
