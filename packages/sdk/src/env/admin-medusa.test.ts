import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getMedusaAdminBaseUrl } from "../medusa-env.js";
import { assertAdminMedusaEnvProduction } from "./admin-medusa.js";

const envBackup: Record<string, string | undefined> = {};

function backupEnv(keys: string[]) {
  for (const k of keys) {
    envBackup[k] = process.env[k];
  }
}

function restoreEnv(keys: string[]) {
  for (const k of keys) {
    if (envBackup[k] !== undefined) process.env[k] = envBackup[k];
    else delete process.env[k];
  }
}

const ENV_KEYS = [
  "NODE_ENV",
  "MEDUSA_SECRET_API_KEY",
  "MEDUSA_ADMIN_API_SECRET",
  "NEXT_PUBLIC_MEDUSA_URL",
  "MEDUSA_BACKEND_URL",
];

describe("admin-medusa env", () => {
  beforeEach(() => backupEnv(ENV_KEYS));
  afterEach(() => restoreEnv(ENV_KEYS));

  it("assertAdminMedusaEnvProduction: no-op when NODE_ENV !== production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.MEDUSA_SECRET_API_KEY;
    assert.doesNotThrow(() => assertAdminMedusaEnvProduction());
  });

  it("assertAdminMedusaEnvProduction: throws when production and secret missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.MEDUSA_SECRET_API_KEY;
    delete process.env.MEDUSA_ADMIN_API_SECRET;
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    assert.throws(
      () => assertAdminMedusaEnvProduction(),
      /MEDUSA_SECRET_API_KEY/,
    );
  });

  it("assertAdminMedusaEnvProduction: throws when production URL is localhost", () => {
    process.env.NODE_ENV = "production";
    process.env.MEDUSA_SECRET_API_KEY = "sk_123";
    process.env.MEDUSA_BACKEND_URL = "http://localhost:9000";
    delete process.env.NEXT_PUBLIC_MEDUSA_URL;
    assert.throws(
      () => assertAdminMedusaEnvProduction(),
      /localhost/,
    );
  });

  it("assertAdminMedusaEnvProduction: passes when production with secret and public URL", () => {
    process.env.NODE_ENV = "production";
    process.env.MEDUSA_SECRET_API_KEY = "sk_123";
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    assert.doesNotThrow(() => assertAdminMedusaEnvProduction());
  });

  it("getMedusaAdminBaseUrl: resolves the same backend origin as storefront helpers", () => {
    process.env.MEDUSA_BACKEND_URL = "http://localhost:9000";
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    assert.strictEqual(getMedusaAdminBaseUrl(), "https://api.example.com");
  });
});
