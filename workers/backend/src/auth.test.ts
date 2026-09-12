import assert from "node:assert/strict";
import test from "node:test";
import { verifyWorkerBearerToken } from "./auth.ts";

function encode(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

test("verifies an expiring Worker JWT and rejects tampering", async () => {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "cus_1", exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = btoa(
    String.fromCharCode(
      ...new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(`${header}.${payload}`),
        ),
      ),
    ),
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  assert.equal(
    (
      await verifyWorkerBearerToken(
        `Bearer ${header}.${payload}.${signature}`,
        "secret",
        1_000_000_000,
      )
    )?.sub,
    "cus_1",
  );
  assert.equal(
    await verifyWorkerBearerToken(
      `Bearer ${header}.${payload}.bad`,
      "secret",
      1_000_000_000,
    ),
    null,
  );
});

test("verifies Supabase Auth JWTs through the issuer JWKS", async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  publicJwk.kid = "supabase-test";
  const issuer = "https://auth.example.test/auth/v1";
  const header = encode({ alg: "RS256", typ: "JWT", kid: publicJwk.kid });
  const payload = encode({ sub: "user_1", aud: "authenticated", iss: issuer, exp: 2_000_000_000 });
  const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  )))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  let fetchCount = 0;
  const claims = await verifyWorkerBearerToken(`Bearer ${header}.${payload}.${signature}`, {
    supabaseUrl: "https://auth.example.test",
    fetch: async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
    },
  }, 1_000_000_000);
  assert.equal(claims?.sub, "user_1");
  assert.equal(fetchCount, 1);
});
