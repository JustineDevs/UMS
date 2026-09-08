import assert from "node:assert/strict";
import test from "node:test";
import { getAdminAuthSecret } from "./auth-secret";

test("admin auth accepts the documented secret aliases", () => {
  assert.equal(
    getAdminAuthSecret({ NEXTAUTH_SECRET: " next-auth ", AUTH_SECRET: "auth" }),
    "next-auth",
  );
  assert.equal(getAdminAuthSecret({ AUTH_SECRET: " auth " }), "auth");
  assert.equal(getAdminAuthSecret({ NEXTAUTH_SECRET: " ", AUTH_SECRET: " " }), undefined);
});
