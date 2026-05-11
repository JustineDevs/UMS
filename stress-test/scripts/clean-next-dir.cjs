"use strict";

/**
 * Thin wrapper: implementation lives in `scripts/clean-next-dir.cjs` (always in git for CI/CD).
 */

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootScript = path.join(__dirname, "..", "..", "scripts", "clean-next-dir.cjs");
const r = spawnSync(process.execPath, [rootScript, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: false,
});
process.exit(r.status ?? 1);
