import assert from "node:assert/strict";
import test from "node:test";

import { createE2eSessionValue, verifyE2eSessionValue } from "./e2e-session";

test("E2E session accepts email addresses with dotted domains", () => {
  const environment = process.env as Record<string, string | undefined>;
  const original = {
    nodeEnv: process.env.NODE_ENV,
    e2e: process.env.UVS_E2E_REAL_SESSION,
    vercel: process.env.VERCEL,
    authSecret: process.env.AUTH_SECRET,
  };

  environment.NODE_ENV = "development";
  environment.UVS_E2E_REAL_SESSION = "1";
  delete environment.VERCEL;
  environment.AUTH_SECRET = "test-only-session-secret";

  try {
    const now = 1_800_000_000_000;
    const value = createE2eSessionValue("staff@example.com", now);
    assert.ok(value);
    assert.equal(verifyE2eSessionValue(value, now), "staff@example.com");
  } finally {
    if (original.nodeEnv === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = original.nodeEnv;
    if (original.e2e === undefined) delete environment.UVS_E2E_REAL_SESSION;
    else environment.UVS_E2E_REAL_SESSION = original.e2e;
    if (original.vercel === undefined) delete environment.VERCEL;
    else environment.VERCEL = original.vercel;
    if (original.authSecret === undefined) delete environment.AUTH_SECRET;
    else environment.AUTH_SECRET = original.authSecret;
  }
});
