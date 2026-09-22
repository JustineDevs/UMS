import assert from "node:assert/strict";
import test from "node:test";
import { handleBackendRequest, nativeDatabaseRole, probeWorkerDatabaseRoles } from "./router.ts";

const env = {
  ALLOWED_ORIGINS: "https://universalmusic-preview.vercel.app",
};

test("routes webhook persistence to the APP database role", () => {
  assert.equal(nativeDatabaseRole({ webhookMatch: true }), "app");
});

test("routes CMS page reads and mutation history to the APP database role", () => {
  assert.equal(nativeDatabaseRole({ cmsAdminPageListMatch: true }), "app");
  assert.equal(nativeDatabaseRole({ cmsAdminPageDetailMatch: true }), "app");
  assert.equal(nativeDatabaseRole({ cmsAdminPageMutationsMatch: true }), "app");
});

test("CMS page endpoints fail closed when APP Hyperdrive is missing", async () => {
  const paths = [
    "/api/admin/cms/pages",
    "/api/admin/cms/pages/00000000-0000-4000-8000-000000000001",
    "/api/admin/cms/pages/00000000-0000-4000-8000-000000000001/mutations",
  ];
  for (const path of paths) {
    const response = await handleBackendRequest(
      new Request(`https://worker.test${path}`),
      env,
    );
    assert.equal(response.status, 503, path);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "database_not_configured",
      path,
    );
  }
});

test("router uses the canonical JWT secret for staff tokens across admin handlers", async () => {
  const response = await handleBackendRequest(
    new Request("https://worker.test/api/admin/payments"),
    { ...env, JWT_SECRET: "canonical-secret", CMS_ADMIN_JWT_SECRET: "stale-secret" },
  );
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error: string }).error, "database_not_configured");
});

test("routes channel webhook and staff event contracts to the APP database role", () => {
  assert.equal(nativeDatabaseRole({ channelWebhookMatch: true }), "app");
  assert.equal(nativeDatabaseRole({ channelEventListMatch: true }), "app");
  assert.equal(nativeDatabaseRole({ channelEventProcessMatch: true }), "app");
});

test("channel event routes fail closed when APP Hyperdrive is missing", async () => {
  const response = await handleBackendRequest(
    new Request("https://worker.test/api/admin/channels/events"),
    env,
  );
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error: string }).error, "database_not_configured");
});

test("routes customer profiles to the APP database role", () => {
  assert.equal(nativeDatabaseRole({ customerProfileMatch: true }), "app");
  assert.equal(nativeDatabaseRole({ paymentAttemptRecoveryMatch: true }), "app");
  assert.equal(nativeDatabaseRole({ customerLoyaltyMatch: true }), "app");
});

test("payment-attempt recovery is a native APP route and fails closed without Hyperdrive", async () => {
  const response = await handleBackendRequest(
    new Request("https://worker.test/store/checkout-intents/recover?provider=stripe", {
      headers: { Cookie: "mcart_id=cart_1" },
    }),
    env,
  );
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error: string }).error, "database_not_configured");
});

test("keeps customer orders on the commerce database role", () => {
  assert.equal(nativeDatabaseRole({ customerOrdersMatch: true }), "medusa");
});

test("keeps catalog taxonomy reads on the commerce database role", () => {
  assert.equal(nativeDatabaseRole({ catalogCategoriesMatch: true }), "medusa");
});

test("bulk fulfillment is APP-owned and requires both database roles", async () => {
  assert.equal(nativeDatabaseRole({ bulkFulfillmentMatch: true }), "app");
  for (const bindings of [
    {},
    { APP_HYPERDRIVE: { connectionString: "postgres://app" } },
    { MEDUSA_HYPERDRIVE: { connectionString: "postgres://commerce" } },
  ]) {
    const response = await handleBackendRequest(
      new Request("https://worker.test/api/admin/orders/bulk-fulfill", { method: "POST" }),
      { ...env, ...bindings },
    );
    assert.equal(response.status, 503);
    assert.equal(((await response.json()) as { error: string }).error, "database_not_configured");
  }
});

test("Pancake provider reads are APP-owned and fail closed without APP Hyperdrive", async () => {
  assert.equal(nativeDatabaseRole({ adminPancakeIntegrationMatch: true }), "app");
  const response = await handleBackendRequest(
    new Request("https://worker.test/api/admin/integrations/pancake?resource=shops"),
    env,
  );
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error: string }).error, "database_not_configured");
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

test("serves the documented health compatibility alias", async () => {
  const response = await handleBackendRequest(new Request("https://worker.test/health"), env);
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

test("readiness probes both database roles and reports an unreachable role", async () => {
  const env = {
    APP_HYPERDRIVE: { connectionString: "postgres://app" },
    MEDUSA_HYPERDRIVE: { connectionString: "postgres://commerce" },
  };
  const roles: string[] = [];
  const databaseRoles = await probeWorkerDatabaseRoles(env, async (role) => {
    roles.push(role);
    return role === "app";
  });
  assert.deepEqual(roles.sort(), ["app", "medusa"]);
  assert.deepEqual(databaseRoles, { app: true, medusa: false });
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
