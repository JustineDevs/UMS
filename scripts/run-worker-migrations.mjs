#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import {
  WORKER_MIGRATIONS,
  migrationChecksum,
  validateMigrationRecord,
  validateRequiredSchema,
} from "./worker-migration-contract.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local"), override: false });

if (process.argv.includes("--target=medusa")) {
  const databaseUrl = process.env.MEDUSA_DB_URL;
  if (!databaseUrl?.trim()) throw new Error("MEDUSA_DB_URL is required for the commerce idempotency ledger");
  const sql = await readFile(join(root, "workers", "backend", "migrations", "002_medusa_worker_idempotency.sql"), "utf8");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    const check = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='worker_idempotency_records'`);
    if (check.rowCount !== 1) throw new Error("Commerce idempotency ledger verification failed");
    console.log("Applied and verified the commerce idempotency ledger");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
  process.exit(0);
}

const databaseUrl = process.env.APP_DB_URL;
if (!databaseUrl?.trim()) {
  console.error("APP_DB_URL is required; refusing to apply the Worker ledger to the commerce database implicitly.");
  process.exit(1);
}

const migration = WORKER_MIGRATIONS[0];
const statusOnly = process.argv.includes("--status");
const dryRun = process.argv.includes("--dry-run");
const sql = await readFile(join(root, "workers", "backend", "migrations", migration.filename), "utf8");
const checksum = migrationChecksum(sql);
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

async function schemaStatus() {
  const result = await client.query(
    `SELECT table_name, column_name AS column
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [migration.requiredTables],
  );
  return validateRequiredSchema(
    [...new Set(result.rows.map((row) => row.table_name))],
    result.rows.map((row) => ({ table: row.table_name, column: row.column })),
  );
}

try {
  const existingCommerceTables = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     AND table_name = ANY($1::text[])`,
    [["cart", "product", "product_variant", "order"]],
  );
  const foundCommerceTables = new Set(existingCommerceTables.rows.map((row) => row.table_name));
  if (foundCommerceTables.size === 4) {
    throw new Error("APP_DB_URL points at the Medusa commerce database; refusing to apply the Worker ledger there");
  }

  const table = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'worker_schema_migrations'`,
  );
  const checksumColumn = table.rowCount === 1
    ? await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'worker_schema_migrations'
           AND column_name = 'checksum'`,
      )
    : { rowCount: 0 };
  if (table.rowCount === 1 && checksumColumn.rowCount === 0 && !statusOnly) {
    await client.query("ALTER TABLE public.worker_schema_migrations ADD COLUMN IF NOT EXISTS checksum text");
  }
  const applied = table.rowCount === 1
    ? await client.query(
        `SELECT ${checksumColumn.rowCount === 1 || !statusOnly ? "checksum" : "NULL::text AS checksum"}
         FROM public.worker_schema_migrations WHERE filename = $1`,
        [migration.filename],
      )
    : { rowCount: 0, rows: [] };
  const record = applied.rowCount === 1 ? applied.rows[0] : null;
  const migrationState = validateMigrationRecord(record, checksum);
  if (migrationState.reason === "checksum_mismatch") {
    throw new Error(`Worker migration checksum mismatch for ${migration.filename}; refusing to continue`);
  }

  if (statusOnly) {
    console.log(JSON.stringify({
      migration: migration.filename,
      checksum,
      applied: migrationState.applied,
      schema: await schemaStatus(),
    }));
  } else if (!migrationState.applied && dryRun) {
    console.log(`Would apply ${migration.filename}`);
  } else if (!migrationState.applied) {
    await client.query("BEGIN");
    await client.query(`CREATE TABLE IF NOT EXISTS public.worker_schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum text
    )`);
    await client.query(sql);
    await client.query(
      "INSERT INTO public.worker_schema_migrations (filename, checksum) VALUES ($1, $2)",
      [migration.filename, checksum],
    );
    await client.query("COMMIT");
    const verified = await schemaStatus();
    if (!verified.valid) {
      throw new Error(`Worker migration schema verification failed: ${JSON.stringify(verified)}`);
    }
    console.log(`Applied and verified ${migration.filename}`);
  } else {
    const verified = await schemaStatus();
    if (!verified.valid) {
      throw new Error(`Worker migration schema verification failed: ${JSON.stringify(verified)}`);
    }
    if (migrationState.reason === "missing_checksum") {
      await client.query(
        "UPDATE public.worker_schema_migrations SET checksum = $2 WHERE filename = $1",
        [migration.filename, checksum],
      );
      console.log(`Verified legacy ${migration.filename} and recorded checksum`);
    } else {
      console.log(`Already applied and verified ${migration.filename}`);
    }
  }
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The connection may not be inside a transaction for status/dry-run.
  }
  throw error;
} finally {
  await client.end();
}
