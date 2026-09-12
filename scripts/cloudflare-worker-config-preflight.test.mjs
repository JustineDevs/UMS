import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkerConfig } from "./cloudflare-worker-config-preflight.mjs";

const validConfig = `
  "env": {
    "dev": { "hyperdrive": [{ "binding": "APP_HYPERDRIVE", "id": "app-dev" }] },
    "production": { "hyperdrive": [{ "binding": "APP_HYPERDRIVE", "id": "app-prod" }] }
  }
`;

test("accepts separate APP Hyperdrive bindings in both environments", () => {
  assert.deepEqual(validateWorkerConfig(validConfig), {
    ok: true,
    message: "Worker database bindings are configured for dev and production.",
  });
});

test("rejects a config that only binds the Medusa database", () => {
  const result = validateWorkerConfig(validConfig.replaceAll("APP_HYPERDRIVE", "MEDUSA_HYPERDRIVE"));
  assert.equal(result.ok, false);
  assert.match(result.message, /dev, production/);
  assert.match(result.message, /cannot be reused/);
});

test("reports only the environment missing the APP binding", () => {
  const result = validateWorkerConfig(validConfig.replace(
    '"production": { "hyperdrive": [{ "binding": "APP_HYPERDRIVE", "id": "app-prod" }] }',
    '"production": { "hyperdrive": [{ "binding": "MEDUSA_HYPERDRIVE", "id": "medusa-prod" }] }',
  ));
  assert.deepEqual(result, {
    ok: false,
    message:
      "Missing APP_HYPERDRIVE binding in: production. Provision a separate application-database Hyperdrive config before deployment; the existing MEDUSA_HYPERDRIVE cannot be reused for APP queries.",
  });
});

test("rejects container bindings in the Worker-only topology", () => {
  const result = validateWorkerConfig(validConfig.replace(
    '"env": {',
    '"containers": [{ "class_name": "MedusaContainer" }], "env": {',
  ));
  assert.equal(result.ok, false);
  assert.match(result.message, /container binding/);
});

test("rejects arbitrary legacy container bindings, not only known names", () => {
  const result = validateWorkerConfig(validConfig.replace(
    '"env": {',
    '"vars": { "LEGACY_CONTAINER": "removed" }, "env": {',
  ));
  assert.equal(result.ok, false);
  assert.match(result.message, /container binding/);
});
