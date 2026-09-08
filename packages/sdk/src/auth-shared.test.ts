import assert from "node:assert/strict";
import test from "node:test";

import { buildSharedJwtCallback, buildSharedJwtCallbackWithResolver, buildSharedSessionCallback } from "./auth-shared";

test("shared auth callbacks persist and expose the signed authentication time", async () => {
  const jwt = buildSharedJwtCallback();
  const token = await jwt({
    token: {},
    user: { id: "user_1", email: "buyer@example.com" },
    account: null,
  });
  assert.equal(typeof token.authenticatedAt, "number");

  const session = await buildSharedSessionCallback()({
    session: { user: {} },
    token,
  });
  assert.equal(session.authenticatedAt, token.authenticatedAt);
});

test("shared auth callbacks persist a resolved commerce customer identity", async () => {
  const jwt = buildSharedJwtCallbackWithResolver({
    resolveCustomerId: async (email) => email === "buyer@example.com" ? "cus_123" : null,
  });
  const token = await jwt({
    token: {},
    user: { email: "buyer@example.com" },
    account: null,
  });
  assert.equal(token.medusaCustomerId, "cus_123");

  const session = await buildSharedSessionCallback()({
    session: { user: {} },
    token,
  });
  assert.equal(session.user?.medusaCustomerId, "cus_123");
});
