import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkerConfig } from "./cloudflare-worker-config-preflight.mjs";

const validConfig = `
  "env": {
    "dev": {
      "hyperdrive": [{ "binding": "APP_HYPERDRIVE", "id": "app-dev" }],
      "vars": {
        "ALLOWED_ORIGINS": "https://universalmusic-preview.vercel.app,http://localhost:3000",
        "PUBLIC_SITE_URL": "https://universalmusic-preview.vercel.app",
        "CMS_ORGANIZATION_ID": "dev-tenant",
        "DEFAULT_ORGANIZATION_ID": "dev-tenant"
      }
    },
    "production": {
      "hyperdrive": [{ "binding": "APP_HYPERDRIVE", "id": "app-prod" }],
      "vars": {
        "ALLOWED_ORIGINS": "https://universalmusic.vercel.app",
        "PUBLIC_SITE_URL": "https://universalmusic.vercel.app",
        "CMS_ORGANIZATION_ID": "prod-tenant",
        "DEFAULT_ORGANIZATION_ID": "prod-tenant"
      }
    }
  }
`;

test("accepts separate APP Hyperdrive bindings in both environments", () => {
  assert.deepEqual(validateWorkerConfig(validConfig), {
    ok: true,
    message: "Worker database bindings and environment-specific vars are explicit for dev and production.",
  });
});

test("rejects root-level shared vars that could leak across environments", () => {
  const result = validateWorkerConfig(validConfig.replace(
    '"env": {',
    '"vars": { "PUBLIC_SITE_URL": "https://universalmusic.vercel.app" }, "env": {',
  ));
  assert.deepEqual(result, {
    ok: false,
    message: "Worker vars must be declared inside dev and production; root-level shared vars are not allowed.",
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
    '"binding": "APP_HYPERDRIVE", "id": "app-prod"',
    '"binding": "MEDUSA_HYPERDRIVE", "id": "medusa-prod"',
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

test("rejects environment-specific vars that are only inherited from the root", () => {
  const result = validateWorkerConfig(validConfig.replaceAll('"CMS_ORGANIZATION_ID": "dev-tenant",', ''));
  assert.equal(result.ok, false);
  assert.match(result.message, /dev\.CMS_ORGANIZATION_ID/);
});

test("rejects a preview environment pointing at the stable storefront", () => {
  const result = validateWorkerConfig(validConfig.replace(
    '"PUBLIC_SITE_URL": "https://universalmusic-preview.vercel.app"',
    '"PUBLIC_SITE_URL": "https://universalmusic.vercel.app"',
  ));
  assert.equal(result.ok, false);
  assert.match(result.message, /origins are misaligned/);
});
