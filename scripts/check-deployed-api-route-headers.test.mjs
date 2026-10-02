import assert from "node:assert/strict";
import test from "node:test";
import {
  loadApiRouteContract,
  runChecks,
  sourcePathToApiPath,
  validateApiRouteHeaders,
} from "./check-deployed-api-route-headers.mjs";

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

test("source route paths normalize route groups and dynamic segments", () => {
  assert.equal(sourcePathToApiPath("/repo/api/account/(group)/orders/[orderId]/route.ts", "/repo/api"), "/api/account/orders/__contract__");
  assert.equal(sourcePathToApiPath("/repo/api/forms/[...formKey]/route.ts", "/repo/api"), "/api/forms/__contract__");
});

test("repository API inventory includes every route file and known public exceptions", () => {
  const routes = loadApiRouteContract();
  assert.ok(routes.length >= 200);
  assert.ok(routes.some((route) => route.path === "/api/account/profile" && route.cache === "private"));
  assert.ok(routes.some((route) => route.path === "/api/shop/search-suggest" && route.cache === "public"));
  assert.ok(routes.some((route) => route.path === "/api/reviews/feed" && route.cache === "private"));
});

test("all-route validator rejects missing hardening headers", () => {
  const failures = validateApiRouteHeaders(
    { headers: new Headers({ "cache-control": "private, no-store" }) },
    { cache: "private" },
    "https://example.test/api/private",
  );
  assert.equal(failures.length, 5);
});

test("all-route runner checks every supplied source route", async () => {
  const contracts = [
    { path: "/api/private", cache: "private" },
    { path: "/api/shop/search-suggest", cache: "public" },
  ];
  const seen = [];
  const failures = await runChecks({
    baseUrl: "https://example.test",
    contracts,
    fetchImpl: async (url) => {
      seen.push(url);
      const isPublic = url.endsWith("search-suggest");
      return new Response(null, {
        status: 404,
        headers: headers({ "cache-control": isPublic ? "public, max-age=60" : "private, no-store" }),
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.deepEqual(seen, ["https://example.test/api/private", "https://example.test/api/shop/search-suggest"]);
});
