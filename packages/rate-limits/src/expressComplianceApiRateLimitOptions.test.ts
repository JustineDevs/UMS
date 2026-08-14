/**
 * Locks defaults and env overrides for compliance API rate limiting (no drift).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { expressComplianceApiRateLimitOptions } from "./index";

const WINDOW = "RATE_LIMIT_COMPLIANCE_WINDOW_MS";
const MAX = "RATE_LIMIT_COMPLIANCE_MAX";

function snapshotEnv(keys: string[]): Record<string, string | undefined> {
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) prev[k] = process.env[k];
  return prev;
}

function restoreEnv(prev: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

test("expressComplianceApiRateLimitOptions: defaults (window 60s, max 60)", () => {
  const keys = [WINDOW, MAX];
  const prev = snapshotEnv(keys);
  try {
    delete process.env[WINDOW];
    delete process.env[MAX];
    const o = expressComplianceApiRateLimitOptions();
    assert.equal(o.windowMs, 60_000);
    assert.equal(o.max, 60);
    assert.equal(o.standardHeaders, true);
    assert.equal(o.legacyHeaders, false);
  } finally {
    restoreEnv(prev);
  }
});

test("expressComplianceApiRateLimitOptions: env overrides", () => {
  const keys = [WINDOW, MAX];
  const prev = snapshotEnv(keys);
  try {
    process.env[WINDOW] = "120000";
    process.env[MAX] = "10";
    const o = expressComplianceApiRateLimitOptions();
    assert.equal(o.windowMs, 120_000);
    assert.equal(o.max, 10);
  } finally {
    restoreEnv(prev);
  }
});

test("expressComplianceApiRateLimitOptions: invalid env falls back to defaults", () => {
  const keys = [WINDOW, MAX];
  const prev = snapshotEnv(keys);
  try {
    process.env[WINDOW] = "not-a-number";
    process.env[MAX] = "-5";
    const o = expressComplianceApiRateLimitOptions();
    assert.equal(o.windowMs, 60_000);
    assert.equal(o.max, 60);
  } finally {
    restoreEnv(prev);
  }
});
