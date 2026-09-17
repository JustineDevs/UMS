import assert from "node:assert/strict";
import { test } from "node:test";
import { adminErr, adminOk } from "./admin-operation-result";

test("adminOk wraps data", () => {
  const r = adminOk({ id: "1" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.id, "1");
});

test("adminErr carries code and status", () => {
  const r = adminErr("X", "msg", 400);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "X");
    assert.equal(r.message, "msg");
    assert.equal(r.httpStatus, 400);
  }
});
