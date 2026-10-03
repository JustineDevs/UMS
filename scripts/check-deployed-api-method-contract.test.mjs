import assert from "node:assert/strict";
import test from "node:test";
import {
  loadApiMethodContract,
  runChecks,
  validateApiMethodResponse,
} from "./check-deployed-api-method-contract.mjs";

function headers() {
  return new Headers({
    "cache-control": "private, no-store",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "strict-transport-security": "max-age=63072000",
    "content-security-policy": "frame-ancestors 'self'",
    "permissions-policy": "camera=()",
    "content-type": "application/json; charset=utf-8",
  });
}

test("method inventory includes declared mutation handlers", () => {
  const contracts = loadApiMethodContract();
  assert.ok(contracts.length >= 250);
  assert.ok(contracts.some((entry) => entry.method === "POST"));
  assert.ok(contracts.some((entry) => entry.method === "DELETE"));
  assert.ok(contracts.some((entry) => entry.path === "/api/account/profile" && entry.method === "PATCH"));
});

test("method validator rejects 5xx and non-JSON responses", () => {
  const response = new Response("oops", { status: 500, headers: { "cache-control": "private, no-store" } });
  const failures = validateApiMethodResponse({ response, contract: { method: "POST", cache: "private" }, url: "https://example.test/api/private" });
  assert.equal(failures.length, 7);
});

test("runner exercises every supplied method contract", async () => {
  const seen = [];
  const failures = await runChecks({
    baseUrl: "https://example.test",
    contracts: [
      { path: "/api/private", method: "GET", cache: "private" },
      { path: "/api/private", method: "POST", cache: "private" },
    ],
    fetchImpl: async (url, init) => {
      seen.push([url, init.method, init.headers["Content-Type"] ?? null, init.headers["Idempotency-Key"] ?? null]);
      return new Response("{}", { status: 401, headers: headers() });
    },
  });
  assert.deepEqual(failures, []);
  assert.deepEqual(seen, [
    ["https://example.test/api/private", "GET", null, null],
    ["https://example.test/api/private", "POST", "application/json", "codex-contract-post"],
  ]);
});
