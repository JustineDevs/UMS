import assert from "node:assert/strict";
import test from "node:test";

import { getAuthSecret } from "./auth-secret";

test("auth secret accepts the application signing secret", () => {
  assert.equal(getAuthSecret({ AUTH_SECRET: " auth " }), "auth");
  assert.equal(getAuthSecret({ AUTH_SECRET: "  " }), undefined);
});
