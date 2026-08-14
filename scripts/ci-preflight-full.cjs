#!/usr/bin/env node
/**
 * Stronger local gate: same as ci:preflight, then full Turbo build (matches "ship with build green" intent).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function run(label, command, args) {
  console.log(`\n━━━ ${label} ━━━\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  return result.status ?? 1;
}

let code = run("ci:preflight", "pnpm", ["run", "ci:preflight"]);
if (code !== 0) {
  process.exit(code);
}

code = run("turbo: build", "pnpm", ["exec", "turbo", "run", "build", "--continue"]);
process.exit(code);
