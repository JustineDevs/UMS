import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeLogPayload } from "./logger.js";

test("sanitizeLogPayload: redacts sensitive keys", () => {
  const out = sanitizeLogPayload({
    requestId: "req-1",
    password: "hunter2",
    apiKey: "sk_live_xxx",
    nested: { refresh_token: "rt", safe: "ok" },
  });
  assert.equal(out.password, "[REDACTED]");
  assert.equal(out.apiKey, "[REDACTED]");
  assert.deepEqual(out.nested, {
    refresh_token: "[REDACTED]",
    safe: "ok",
  });
});

test("sanitizeLogPayload: redacts JWT-shaped strings", () => {
  const longJwt =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    "eyJzdWIiOiIxMjM0NTY3ODkwIn0." +
    "dozjgNryP4J3jVmNHl0w5N_XmcLZE1qCQlk4r3rY";
  const out = sanitizeLogPayload({ tokenPreview: longJwt });
  assert.equal(out.tokenPreview, "[REDACTED_JWT]");
});

test("sanitizeLogPayload: redacts whole-string emails", () => {
  const out = sanitizeLogPayload({
    user: "user@example.com",
    note: "contact us",
  });
  assert.equal(out.user, "[REDACTED_EMAIL]");
  assert.equal(out.note, "contact us");
});

test("sanitizeLogPayload: preserves non-sensitive fields", () => {
  const out = sanitizeLogPayload({
    type: "application_error",
    status: 500,
    path: "/api/x",
    method: "POST",
  });
  assert.equal(out.type, "application_error");
  assert.equal(out.status, 500);
  assert.equal(out.path, "/api/x");
  assert.equal(out.method, "POST");
});

test("sanitizeLogPayload: does not redact non-sensitive key containing 'token' substring", () => {
  const out = sanitizeLogPayload({
    requestId: "req-1",
    tokenPreview: "first-8-chars",
  });
  assert.equal(out.tokenPreview, "first-8-chars");
});

test("sanitizeLogPayload: redacts key named exactly 'token'", () => {
  const out = sanitizeLogPayload({ token: "abc123" });
  assert.equal(out.token, "[REDACTED]");
});

test("sanitizeLogPayload: sanitizes arrays", () => {
  const out = sanitizeLogPayload({
    emails: ["user@example.com", "safe-string"],
  });
  const arr = out.emails as string[];
  assert.equal(arr[0], "[REDACTED_EMAIL]");
  assert.equal(arr[1], "safe-string");
});

test("sanitizeLogPayload: handles null and undefined values", () => {
  const out = sanitizeLogPayload({ a: null, b: undefined, c: 42 });
  assert.equal(out.a, null);
  assert.equal(out.b, undefined);
  assert.equal(out.c, 42);
});
