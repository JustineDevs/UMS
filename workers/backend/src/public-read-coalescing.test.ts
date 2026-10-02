import assert from "node:assert/strict";
import test from "node:test";
import { coalescePublicRead } from "./router.ts";

test("coalesces concurrent public reads without sharing a consumed response body", async () => {
  let calls = 0;
  const operation = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const responses = await Promise.all([
    coalescePublicRead("navigation", operation),
    coalescePublicRead("navigation", operation),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(await responses[0].json(), { ok: true });
  assert.deepEqual(await responses[1].json(), { ok: true });
});

test("does not retain a completed public response", async () => {
  let calls = 0;
  const operation = async () => {
    calls += 1;
    return new Response(String(calls));
  };

  const first = await coalescePublicRead("metadata", operation);
  const second = await coalescePublicRead("metadata", operation);

  assert.equal(await first.text(), "1");
  assert.equal(await second.text(), "2");
  assert.equal(calls, 2);
});
