import assert from "node:assert/strict";
import test from "node:test";
import { parseBoundedJson } from "./bounded-request-body";

test("admin bounded JSON parser rejects oversized editor payloads", async () => {
  const result = await parseBoundedJson(
    new Request("https://admin.test", { method: "POST", body: JSON.stringify({ tree: "x".repeat(100) }) }),
    64,
  );
  assert.equal(result.tooLarge, true);
  assert.equal(result.valid, false);
});

test("admin bounded JSON parser accepts valid payloads", async () => {
  const result = await parseBoundedJson(
    new Request("https://admin.test", { method: "POST", body: JSON.stringify({ id: "page_1" }) }),
    1024,
  );
  assert.deepEqual(result.value, { id: "page_1" });
  assert.equal(result.valid, true);
});
