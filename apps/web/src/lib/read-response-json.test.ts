import assert from "node:assert/strict";
import test from "node:test";
import { readResponseJson } from "./read-response-json";

test("readResponseJson preserves valid success and error envelopes", async () => {
  assert.deepEqual(
    await readResponseJson(new Response(JSON.stringify({ ok: true })), { ok: false }),
    { ok: true },
  );
  assert.deepEqual(
    await readResponseJson(new Response(JSON.stringify({ error: "bad" }), { status: 422 }), {}),
    { error: "bad" },
  );
});

test("readResponseJson applies a bounded fallback to invalid JSON", async () => {
  assert.deepEqual(
    await readResponseJson(new Response("not-json"), { error: "invalid" }),
    { error: "invalid" },
  );
});

test("readResponseJson rejects oversized upstream bodies before JSON parsing", async () => {
  const oversized = JSON.stringify({ payload: "x".repeat(128) });
  assert.deepEqual(
    await readResponseJson(new Response(oversized), { error: "too_large" }, { maxBytes: 32 }),
    { error: "too_large" },
  );
});

test("readResponseJson rejects an oversized declared body before consuming it", async () => {
  const response = new Response("{}", { headers: { "content-length": "100" } });
  assert.deepEqual(
    await readResponseJson(response, { error: "too_large" }, { maxBytes: 32 }),
    { error: "too_large" },
  );
});
