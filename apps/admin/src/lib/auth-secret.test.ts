import assert from "node:assert/strict";
import test from "node:test";
import { getAdminAuthSecret } from "./auth-secret";

test("admin auth accepts the Supabase SSR signing secret", () => {
  assert.equal(
    getAdminAuthSecret({ AUTH_SECRET: " auth " }),
    "auth",
  );
  assert.equal(getAdminAuthSecret({ AUTH_SECRET: " " }), undefined);
});
