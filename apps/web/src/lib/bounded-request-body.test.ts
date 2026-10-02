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

test("bounded JSON parser preserves a JSON null body for route-level validation", async () => {
  assert.deepEqual(
    await parseBoundedJson(new Request("https://storefront.test", { body: "null", method: "POST" }), 64),
    { value: null, tooLarge: false, valid: true },
  );
});

test("bounded JSON parser rejects prototype-pollution keys", async () => {
  assert.deepEqual(
    await parseBoundedJson(
      new Request("https://storefront.test", { body: JSON.stringify({ constructor: { prototype: { polluted: true } } }), method: "POST" }),
      256,
    ),
    { value: null, tooLarge: false, valid: false },
  );
});

test("bounded readers convert an aborted request stream into invalid input", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("aborted"));
    },
  });
  const request = new Request("https://storefront.test", {
    body,
    method: "POST",
    ...( { duplex: "half" } as RequestInit & { duplex: "half" } ),
  });

  assert.deepEqual(await readBoundedRequestBody(request.clone(), 64), { body: "", tooLarge: false });
  assert.deepEqual(await parseBoundedJson(request, 64), { value: null, tooLarge: false, valid: false });
});
