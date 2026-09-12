import assert from "node:assert/strict";
import test from "node:test";
import { isTrackingCapabilityRevoked } from "./tracking-capability-revocation.js";

function clientFor(error: { code?: string; message?: string } | null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: null, error }) };
            },
          };
        },
      };
    },
  } as never;
}

test("local auth-disabled mode treats an unapplied revocation table as not revoked", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAuthDisable = process.env.AUTH_DISABLE;
  process.env.NODE_ENV = "development";
  process.env.AUTH_DISABLE = "true";
  try {
    assert.equal(
      await isTrackingCapabilityRevoked(clientFor({ code: "PGRST205" }), "token"),
      false,
    );
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.AUTH_DISABLE = previousAuthDisable;
  }
});

test("production remains fail-closed when the revocation table is unavailable", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAuthDisable = process.env.AUTH_DISABLE;
  process.env.NODE_ENV = "production";
  process.env.AUTH_DISABLE = "true";
  try {
    assert.equal(
      await isTrackingCapabilityRevoked(clientFor({ code: "42P01" }), "token"),
      null,
    );
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.AUTH_DISABLE = previousAuthDisable;
  }
});
