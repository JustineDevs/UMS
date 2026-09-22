import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "./route";

const e2eEnvironment = [
  "NODE_ENV",
  "AUTH_SECRET",
  "ADMIN_ALLOWED_EMAILS",
  "UVS_E2E_REAL_SESSION",
] as const;

async function withE2eAuthEnabled(run: () => Promise<void>) {
  const env = process.env as Record<string, string | undefined>;
  const original = new Map(e2eEnvironment.map((key) => [key, env[key]]));
  env.NODE_ENV = "development";
  env.AUTH_SECRET = "test-only-e2e-secret";
  env.ADMIN_ALLOWED_EMAILS = "admin@example.com";
  env.UVS_E2E_REAL_SESSION = "1";
  try {
    await run();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

function request(body: string) {
  return new NextRequest("http://localhost/api/auth/e2e", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

test("E2E auth rejects malformed JSON before identity lookup", async () => {
  await withE2eAuthEnabled(async () => {
    const response = await POST(request("{"));
    assert.equal(response.status, 400);
  });
});

test("E2E auth rejects invalid and oversized credential payloads before identity lookup", async () => {
  await withE2eAuthEnabled(async () => {
    for (const body of [
      JSON.stringify({ email: "admin@example.com", password: "secret", extra: true }),
      JSON.stringify({ email: "not-an-email", password: "secret" }),
      JSON.stringify({ email: "admin@example.com", password: "" }),
      JSON.stringify({ email: "admin@example.com", password: "x".repeat(513) }),
      JSON.stringify({ email: "admin@example.com", password: "secret", padding: "x".repeat(4 * 1024) }),
    ]) {
      const response = await POST(request(body));
      assert.equal(response.status, 400);
    }
  });
});
