import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(scriptDirectory, "..", "supabase", "migrations");
const runnerPath = join(scriptDirectory, "run-migrations.ts");

test("APP migration registry includes every SQL file in deterministic numeric order", () => {
  const runner = readFileSync(runnerPath, "utf8");
  const registry = runner.match(/const MIGRATION_FILES = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(registry, "APP runner must declare its reviewed migration registry");
  const registered = [...registry.matchAll(/"([^\"]+\.sql)"/g)].map((match) => match[1]);
  const onDisk = readdirSync(migrationsDirectory).filter((filename) => filename.endsWith(".sql"));
  const compare = (left, right) => left.localeCompare(right, "en", { numeric: true });

  assert.equal(registered.length, onDisk.length);
  assert.deepEqual(registered, [...registered].sort(compare));
  assert.deepEqual(registered, onDisk.sort(compare));
  assert.ok(registered.includes("126_cms_media_storage_cleanup_saga.sql"));
  assert.equal(new Set(registered).size, registered.length);
});
