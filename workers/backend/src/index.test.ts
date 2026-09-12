import assert from "node:assert/strict";
import test from "node:test";
import { handleBackendRequest, nativeDatabaseRole } from "./router.ts";

const env = {
  ALLOWED_ORIGINS: "https://universalmusic-preview.vercel.app",
};

test("routes webhook persistence to the APP database role", () => {
  assert.equal(nativeDatabaseRole({ webhookMatch: true }), "app");
});

test("routes customer profiles to the APP database role", () => {
  assert.equal(nativeDatabaseRole({ customerProfileMatch: true }), "app");
});

test("keeps customer orders on the commerce database role", () => {
  assert.equal(nativeDatabaseRole({ customerOrdersMatch: true }), "medusa");
});

test("serves native worker health without an upstream runtime", async () => {
  const response = await handleBackendRequest(new Request("https://worker.test/healthz"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    runtime: "cloudflare_worker",
    database: false,
    requestId: response.headers.get("X-Request-ID"),
  });
});

test("readiness requires a Hyperdrive binding", async () => {
  const response = await handleBackendRequest(new Request("https://worker.test/readyz"), env);
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { status: string }).status, "not_ready");
});

test("rejects unapproved CORS preflight", async () => {
  const response = await handleBackendRequest(
    new Request("https://worker.test/store/products", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.test" },
    }),
    env,
  );
  assert.equal(response.status, 403);
});

test("does not forward an unimplemented path to a container or origin", async () => {
  const response = await handleBackendRequest(new Request("https://worker.test/legacy/medusa-path"), env);
  assert.equal(response.status, 404);
  assert.equal(((await response.json()) as { error: string }).error, "route_not_implemented");
});

test("fails closed instead of routing an APP request to a commerce origin", async () => {
  const response = await handleBackendRequest(
    new Request("https://worker.test/store/customers/me"),
    { ...env, HYPERDRIVE: { connectionString: "postgres://commerce-test" } },
  );
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error: string }).error, "database_not_configured");
});

test("fails closed when checkout does not have both database roles", async () => {
  const response = await handleBackendRequest(
    new Request("https://worker.test/store/checkout/session", {
      method: "POST",
      body: JSON.stringify({ cartId: "cart_1" }),
      headers: { "Content-Type": "application/json" },
    }),
    { ...env, MEDUSA_HYPERDRIVE: { connectionString: "postgres://commerce-test" } },
  );
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error: string }).error, "database_not_configured");
});
