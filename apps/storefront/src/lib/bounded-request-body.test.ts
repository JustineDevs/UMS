import assert from "node:assert/strict";
import test from "node:test";
import { parseBoundedJson, readBoundedRequestBody } from "./bounded-request-body";

test("bounded request reader accepts a body within the byte limit", async () => {
  assert.deepEqual(
    await readBoundedRequestBody(new Request("https://storefront.test", { body: "{\"reason\":\"spam\"}", method: "POST" }), 64),
    { body: "{\"reason\":\"spam\"}", tooLarge: false },
  );
});

test("bounded request reader cancels an oversized streamed body", async () => {
  const result = await readBoundedRequestBody(
    new Request("https://storefront.test", { body: "x".repeat(65), method: "POST" }),
    64,
  );
  assert.deepEqual(result, { body: "", tooLarge: true });
});

test("bounded JSON parser distinguishes malformed input from oversized input", async () => {
  const invalid = await parseBoundedJson(
    new Request("https://storefront.test", { body: "{", method: "POST" }),
    64,
  );
  assert.deepEqual(invalid, { value: null, tooLarge: false, valid: false });
  const oversized = await parseBoundedJson(
    new Request("https://storefront.test", { body: "x".repeat(65), method: "POST" }),
    64,
  );
  assert.deepEqual(oversized, { value: null, tooLarge: true, valid: false });
});
