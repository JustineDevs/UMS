#!/usr/bin/env node
/**
 * PH-21: Supabase service role key age guard.
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT from the environment (ISO 8601).
 * Exits 0 when:
 *   - The env var is not set (opt-in feature — skips silently).
 *   - The recorded rotation date is within the threshold.
 * Exits 1 when the key is older than ROTATION_THRESHOLD_DAYS (default 90).
 *
 * Add to your release gate or CI pre-flight:
 *   node scripts/check-key-age.mjs
 *
 * Set in .env.local (or CI secrets):
 *   SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT=2026-01-15T00:00:00Z
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local if present (best-effort).
try {
  const envPath = join(__dirname, "..", ".env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // .env.local not present; rely on system environment.
}

const ROTATION_THRESHOLD_DAYS = Number(
  process.env.KEY_ROTATION_THRESHOLD_DAYS ?? "90",
);

const rotatedAt = process.env.SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT?.trim();

if (!rotatedAt) {
  console.log(
    "[key-age] SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT is not set. " +
      "Set it to the date of last key rotation (ISO 8601) to enable age enforcement.",
  );
  process.exit(0);
}

const rotationDate = new Date(rotatedAt);
if (isNaN(rotationDate.getTime())) {
  console.error(
    `[key-age] SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT="${rotatedAt}" is not a valid ISO 8601 date.`,
  );
  process.exit(1);
}

const ageMs = Date.now() - rotationDate.getTime();
const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
const threshold = ROTATION_THRESHOLD_DAYS;

if (ageDays > threshold) {
  console.error(
    `[key-age] FAIL: Supabase service role key is ${ageDays} days old ` +
      `(threshold: ${threshold} days). ` +
      "Rotate the key and update SUPABASE_SERVICE_ROLE_KEY_ROTATED_AT before releasing.",
  );
  process.exit(1);
}

console.log(
  `[key-age] OK: Supabase service role key is ${ageDays} day(s) old ` +
    `(threshold: ${threshold} days).`,
);
process.exit(0);
