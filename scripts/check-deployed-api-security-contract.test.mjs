import assert from "node:assert/strict";
import test from "node:test";
import {
  API_SECURITY_CONTRACT,
  runChecks,
  validateApiSecurityResponse,
} from "./check-deployed-api-security-contract.mjs";

function headers(values = {}) {
  return new Headers({
    "cache-control": "private, no-store",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    "content-security-policy": "default-src 'self'; frame-ancestors 'self'",
    "permissions-policy": "camera=()",
    ...values,
  });
}

test("API security contract covers private and public route classes", () => {
  assert.equal(API_SECURITY_CONTRACT.length, 7);
  assert.equal(API_SECURITY_CONTRACT.filter((route) => route.cache === "private").length, 6);
  assert.equal(API_SECURITY_CONTRACT.filter((route) => route.cache === "public").length, 1);
});

test("private API responses require no-store and security headers", () => {
  const failures = validateApiSecurityResponse(
    { status: 401, headers: headers({ "referrer-policy": "no-referrer" }) },
    { expectedStatuses: [200, 401], cache: "private" },
    "https://example.test/api/private",
  );
  assert.deepEqual(failures, []);
});

test("public API responses require an explicit public cache policy", () => {
  const failures = validateApiSecurityResponse(
    { status: 200, headers: headers({ "cache-control": "public, max-age=60" }) },
    { expectedStatuses: [200], cache: "public" },
    "https://example.test/api/public",
  );
  assert.deepEqual(failures, []);
});

test("contract rejects missing hardening headers and unexpected statuses", () => {
  const failures = validateApiSecurityResponse(
    { status: 500, headers: new Headers({ "cache-control": "private, no-store" }) },
    { expectedStatuses: [200], cache: "private" },
    "https://example.test/api/private",
  );
  assert.equal(failures.length, 7);
});

test("contract runner reports no failures for a complete fixture", async () => {
  const failures = await runChecks({
    baseUrl: "https://example.test",
    fetchImpl: async (url) => {
      const route = API_SECURITY_CONTRACT.find((candidate) => url.endsWith(candidate.path));
      assert.ok(route);
      return new Response(null, {
        status: route.expectedStatuses[0],
        headers: headers({
          "cache-control": route.cache === "public" ? "public, max-age=60" : "private, no-store",
        }),
      });
    },
  });
  assert.deepEqual(failures, []);
});
