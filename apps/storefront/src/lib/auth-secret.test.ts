import assert from "node:assert/strict";
import test from "node:test";

import { getAuthSecret } from "./auth-secret";

test("auth secret prefers NEXTAUTH_SECRET and falls back to AUTH_SECRET", () => {
  assert.equal(getAuthSecret({ NEXTAUTH_SECRET: " next-auth ", AUTH_SECRET: "auth" }), "next-auth");
  assert.equal(getAuthSecret({ AUTH_SECRET: " auth " }), "auth");
  assert.equal(getAuthSecret({ NEXTAUTH_SECRET: "  ", AUTH_SECRET: "  " }), undefined);
});
