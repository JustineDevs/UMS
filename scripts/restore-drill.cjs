#!/usr/bin/env node

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const CONFIRMATION = "RESTORE_DRILL_CONFIRM_DISPOSABLE_TARGET";

function postgresTargetIdentity(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new Error(`${name} must use the PostgreSQL protocol`);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !database)
    throw new Error(`${name} must include a PostgreSQL host and database`);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const username = decodeURIComponent(parsed.username);
  const directProject = hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/)?.[1];
  const isSupabasePooler = hostname === "pooler.supabase.com" || hostname.endsWith(".pooler.supabase.com");
  const pooledProject = isSupabasePooler
    ? username.match(/\.([a-z0-9-]+)$/)?.[1]
    : undefined;
  if (isSupabasePooler && !pooledProject)
    throw new Error(`${name} pooler username must include its Supabase project reference`);

  // Usernames and ports select connection roles/poolers, not the database.
  // Normalize Supabase direct and pooler URLs to the same project identity.
  const server = directProject || pooledProject
    ? `supabase:${directProject ?? pooledProject}`
    : hostname;
  return [server, database].join("\u0000");
}

function validateRestoreInputs(env) {
  if (env[CONFIRMATION] !== "YES")
    throw new Error(`${CONFIRMATION}=YES is required for a disposable restore target`);
  if (!env.APP_DB_URL || !env.MEDUSA_DB_URL)
    throw new Error("APP_DB_URL and MEDUSA_DB_URL are required to protect source databases");
  if (!env.RESTORE_BACKUP_FILE || !env.RESTORE_DATABASE_URL)
    throw new Error("RESTORE_BACKUP_FILE and RESTORE_DATABASE_URL are required");

  const target = postgresTargetIdentity(env.RESTORE_DATABASE_URL, "RESTORE_DATABASE_URL");
  for (const [name, source] of [
    ["APP_DB_URL", env.APP_DB_URL],
    ["MEDUSA_DB_URL", env.MEDUSA_DB_URL],
  ]) {
    if (target === postgresTargetIdentity(source, name))
      throw new Error(`RESTORE_DATABASE_URL must not identify ${name}`);
  }

  let backup;
  try {
    backup = fs.statSync(env.RESTORE_BACKUP_FILE);
  } catch {
    throw new Error("RESTORE_BACKUP_FILE must identify an existing regular file");
  }
  if (!backup.isFile())
    throw new Error("RESTORE_BACKUP_FILE must identify an existing regular file");
}

function runRestoreDrill(env = process.env, run = spawnSync) {
  try {
    validateRestoreInputs(env);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  const preflight = run("pg_restore", ["--list", env.RESTORE_BACKUP_FILE], {
    stdio: "ignore",
    env,
  });
  if (preflight.error) {
    console.error("pg_restore is unavailable; no restore was attempted");
    return 2;
  }
  if (preflight.status !== 0) {
    console.error("Backup archive validation failed; no restore was attempted");
    return preflight.status || 1;
  }

  const restored = run(
    "pg_restore",
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--exit-on-error",
      "--single-transaction",
      "--dbname",
      env.RESTORE_DATABASE_URL,
      env.RESTORE_BACKUP_FILE,
    ],
    { stdio: "inherit", env },
  );
  if (restored.error) throw restored.error;
  return restored.status ?? 1;
}

if (require.main === module) process.exitCode = runRestoreDrill();

module.exports = { postgresTargetIdentity, runRestoreDrill, validateRestoreInputs };
