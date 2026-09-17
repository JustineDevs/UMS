import assert from "node:assert/strict";
import test from "node:test";
import { mapWithConcurrency } from "./async-batching";

test("mapWithConcurrency preserves input order while bounding in-flight work", async () => {
    let active = 0;
    let peak = 0;

    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, value === 1 ? 8 : 1));
      active -= 1;
      return value * 2;
    });

    assert.deepEqual(result, [2, 4, 6, 8, 10]);
    assert.ok(peak <= 2);
});

test("mapWithConcurrency returns immediately for an empty input", async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async (value: never) => value), []);
});
