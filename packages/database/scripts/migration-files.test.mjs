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
  assert.ok(registered.includes("128_schema_cleanup.sql"));
  assert.ok(registered.includes("129_delivery_event_projection_monotonicity.sql"));
  assert.equal(new Set(registered).size, registered.length);
});

test("schema setup does not recreate retired objects or duplicate table definitions", () => {
  const seed = readFileSync(join(migrationsDirectory, "..", "seed.sql"), "utf8");
  assert.doesNotMatch(seed, /legacy_import_runs/);

  const tableDefinitions = new Map();
  for (const filename of readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql"))) {
    const sql = readFileSync(join(migrationsDirectory, filename), "utf8");
    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      const table = match[1].toLowerCase();
      const files = tableDefinitions.get(table) ?? [];
      files.push(filename);
      tableDefinitions.set(table, files);
    }
  }

  const intentionalRebuilds = new Set(["cms_payment_links"]);
  for (const [table, files] of tableDefinitions) {
    if (files.length > 1 && !intentionalRebuilds.has(table)) {
      assert.fail(`duplicate CREATE TABLE definitions for ${table}: ${files.join(", ")}`);
    }
  }
});

test("migration runner uses the canonical ledger and migrates the retired ledger name", () => {
  const runner = readFileSync(runnerPath, "utf8");
  assert.match(runner, /const MIGRATIONS_TABLE = "platform_schema_migrations"/);
  assert.match(runner, /const LEGACY_MIGRATIONS_TABLE = "legacy_platform_schema_migrations"/);
  assert.match(runner, /ALTER TABLE public\.\$\{LEGACY_MIGRATIONS_TABLE\} RENAME TO \$\{MIGRATIONS_TABLE\}/);
  assert.match(runner, /DROP TABLE public\.\$\{LEGACY_MIGRATIONS_TABLE\}/);
});

test("schema cleanup removes only indexes with canonical replacements", () => {
  const cleanup = readFileSync(join(migrationsDirectory, "128_schema_cleanup.sql"), "utf8");
  for (const indexName of [
    "idx_digital_receipts_medusa_order",
    "idx_payment_attempts_organization_updated",
    "idx_cms_ab_experiments_org_key",
    "cms_payment_links_org_id",
    "idx_cms_category_content_canonical",
  ]) {
    assert.match(cleanup, new RegExp(`DROP INDEX IF EXISTS public\\.${indexName}`));
  }
});

test("delivery event projection is monotonic while retaining late events", () => {
  const migration = readFileSync(
    join(migrationsDirectory, "129_delivery_event_projection_monotonicity.sql"),
    "utf8",
  );
  assert.match(migration, /p_occurred_at\s*>\s*current_last_event_at/);
  assert.match(migration, /IF should_project THEN/);
  assert.match(migration, /-- A late event is still recorded/);
});
