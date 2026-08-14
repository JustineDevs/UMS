import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getMedusaStoreBaseUrl } from "../medusa-env.js";
import {
  assertMedusaStorefrontEnvProduction,
  listMissingMedusaStorefrontEnv,
} from "./medusa-storefront.js";

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
  "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
  "MEDUSA_PUBLISHABLE_API_KEY",
  "NEXT_PUBLIC_MEDUSA_REGION_ID",
  "MEDUSA_REGION_ID",
  "NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID",
  "MEDUSA_SALES_CHANNEL_ID",
  "NEXT_PUBLIC_MEDUSA_URL",
  "MEDUSA_BACKEND_URL",
  "MEDUSA_SECRET_API_KEY",
  "MEDUSA_ADMIN_API_SECRET",
];

describe("medusa-storefront env", () => {
  beforeEach(() => backupEnv(ENV_KEYS));
  afterEach(() => restoreEnv(ENV_KEYS));

  it("assertMedusaStorefrontEnvProduction: no-op when NODE_ENV !== production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
    delete process.env.MEDUSA_PUBLISHABLE_API_KEY;
    assert.doesNotThrow(() => assertMedusaStorefrontEnvProduction());
  });

  it("assertMedusaStorefrontEnvProduction: throws when production and publishable key missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
    delete process.env.MEDUSA_PUBLISHABLE_API_KEY;
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID = "reg_123";
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    process.env.MEDUSA_SECRET_API_KEY = "sk_123";
    assert.throws(
      () => assertMedusaStorefrontEnvProduction(),
      /required env missing/,
    );
    assert.throws(
      () => assertMedusaStorefrontEnvProduction(),
      /NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY/,
    );
  });

  it("assertMedusaStorefrontEnvProduction: throws when production and region ID missing", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_123";
    delete process.env.NEXT_PUBLIC_MEDUSA_REGION_ID;
    delete process.env.MEDUSA_REGION_ID;
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    process.env.MEDUSA_SECRET_API_KEY = "sk_123";
    assert.throws(
      () => assertMedusaStorefrontEnvProduction(),
      /NEXT_PUBLIC_MEDUSA_REGION_ID/,
    );
  });

  it("assertMedusaStorefrontEnvProduction: throws when production and sales channel ID missing", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_123";
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID = "reg_123";
    delete process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID;
    delete process.env.MEDUSA_SALES_CHANNEL_ID;
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    process.env.MEDUSA_SECRET_API_KEY = "sk_123";
    assert.throws(
      () => assertMedusaStorefrontEnvProduction(),
      /NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID/,
    );
  });

  it("assertMedusaStorefrontEnvProduction: throws when production and Medusa secret API key missing", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_123";
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID = "reg_123";
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID = "sc_123";
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    delete process.env.MEDUSA_SECRET_API_KEY;
    delete process.env.MEDUSA_ADMIN_API_SECRET;
    assert.throws(
      () => assertMedusaStorefrontEnvProduction(),
      /MEDUSA_SECRET_API_KEY/,
    );
  });

  it("assertMedusaStorefrontEnvProduction: throws when production and URL is localhost", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_123";
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID = "reg_123";
    process.env.MEDUSA_BACKEND_URL = "http://localhost:9000";
    process.env.MEDUSA_SECRET_API_KEY = "sk_123";
    assert.throws(
      () => assertMedusaStorefrontEnvProduction(),
      /must be a public HTTPS origin/,
    );
    assert.throws(
      () => assertMedusaStorefrontEnvProduction(),
      /localhost/,
    );
  });

  it("assertMedusaStorefrontEnvProduction: passes when production and all env valid", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_123";
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID = "reg_123";
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID = "sc_123";
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    process.env.MEDUSA_SECRET_API_KEY = "sk_123";
    assert.doesNotThrow(() => assertMedusaStorefrontEnvProduction());
  });

  it("getMedusaStoreBaseUrl: prefers NEXT_PUBLIC when MEDUSA_BACKEND is loopback and public is not", () => {
    process.env.MEDUSA_BACKEND_URL = "http://localhost:9000";
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    assert.strictEqual(getMedusaStoreBaseUrl(), "https://api.example.com");
  });

  it("assertMedusaStorefrontEnvProduction: production passes when loopback backend is overridden by public URL", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_123";
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID = "reg_123";
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID = "sc_123";
    process.env.MEDUSA_BACKEND_URL = "http://localhost:9000";
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    process.env.MEDUSA_SECRET_API_KEY = "sk_123";
    assert.doesNotThrow(() => assertMedusaStorefrontEnvProduction());
  });

  it("listMissingMedusaStorefrontEnv: returns empty when all present and non-localhost", () => {
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk";
    process.env.NEXT_PUBLIC_MEDUSA_REGION_ID = "reg";
    process.env.NEXT_PUBLIC_MEDUSA_URL = "https://api.example.com";
    const missing = listMissingMedusaStorefrontEnv();
    assert.deepStrictEqual(missing, []);
  });
});
