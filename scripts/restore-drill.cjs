#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const backup = process.env.RESTORE_BACKUP_FILE;
const destination = process.env.RESTORE_DATABASE_URL;
if (!backup || !destination) {
  console.error("Restore drill requires RESTORE_BACKUP_FILE and RESTORE_DATABASE_URL; no restore was attempted.");
  process.exit(2);
}
const result = spawnSync("pg_restore", ["--clean", "--if-exists", "--no-owner", "--exit-on-error", "--dbname", destination, backup], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
