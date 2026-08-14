import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { shouldFailBootForMissingInternalKey } from "./checkProductionInternalApiKey.js";

const envBackup: Record<string, string | undefined> = {};

function backup(...keys: string[]) {
  for (const k of keys) {
    envBackup[k] = process.env[k];
  }
}

function restore(...keys: string[]) {
  for (const k of keys) {
    if (envBackup[k] !== undefined) process.env[k] = envBackup[k];
    else delete process.env[k];
  }
}

describe("checkProductionInternalApiKey", () => {
  beforeEach(() => backup("NODE_ENV", "INTERNAL_API_KEY"));
  afterEach(() => restore("NODE_ENV", "INTERNAL_API_KEY"));

  it("returns false when NODE_ENV is development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.INTERNAL_API_KEY;
    assert.strictEqual(shouldFailBootForMissingInternalKey(), false);
  });

  it("returns false when NODE_ENV is production and INTERNAL_API_KEY is set", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_KEY = "secret-key-123";
    assert.strictEqual(shouldFailBootForMissingInternalKey(), false);
  });

  it("returns true when NODE_ENV is production and INTERNAL_API_KEY is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.INTERNAL_API_KEY;
    assert.strictEqual(shouldFailBootForMissingInternalKey(), true);
  });

  it("returns true when NODE_ENV is production and INTERNAL_API_KEY is empty", () => {
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_API_KEY = "";
    assert.strictEqual(shouldFailBootForMissingInternalKey(), true);
  });
});
