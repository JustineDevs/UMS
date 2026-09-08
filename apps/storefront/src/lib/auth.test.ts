import test from "node:test";
import assert from "node:assert/strict";

import { isStorefrontAuthDisabled } from "./auth";

const env = process.env as Record<string, string | undefined>;

const flagNames = [
  "AUTH_DISABLED",
  "AUTH_DISABLE",
  "NEXT_PUBLIC_AUTH_DISABLED",
  "NEXT_PUBLIC_AUTH_DISABLE",
] as const;

test("server auth bypass accepts the local public flag outside production", () => {
  const original = Object.fromEntries(
    flagNames.map((name) => [name, process.env[name]]),
  );
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    for (const name of flagNames) delete process.env[name];
    env.NODE_ENV = "development";
    env.NEXT_PUBLIC_AUTH_DISABLE = "true";
    assert.equal(isStorefrontAuthDisabled(), true);
  } finally {
    for (const name of flagNames) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
  }
});

test("production auth never trusts a public bypass flag", () => {
  const original = Object.fromEntries(
    flagNames.map((name) => [name, process.env[name]]),
  );
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    for (const name of flagNames) delete process.env[name];
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_AUTH_DISABLE = "true";
    assert.equal(isStorefrontAuthDisabled(), false);
  } finally {
    for (const name of flagNames) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
  }
});
