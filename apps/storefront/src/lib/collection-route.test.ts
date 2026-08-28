import assert from "node:assert/strict";
import test from "node:test";
import { decodeCollectionHandle } from "./collection-route";

test("collection handles decode valid values and reject malformed paths", () => {
  assert.equal(decodeCollectionHandle("electric-guitars"), "electric-guitars");
  assert.equal(decodeCollectionHandle("guitars%20and%20gear"), "guitars and gear");
  assert.equal(decodeCollectionHandle("bad%2Fhandle"), null);
  assert.equal(decodeCollectionHandle("bad%"), null);
});
