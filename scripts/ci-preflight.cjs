#!/usr/bin/env node
/**
 * Local CI preflight before commit automation: Node/native runtime check, then Turbo lint, typecheck, test.
 * Set PREFLIGHT_SKIP_RUNTIME_CHECK=1 to skip the native runtime check.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function run(label, command, args, env = process.env) {
  console.log(`\n━━━ ${label} ━━━\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env,
  });
  return result.status ?? 1;
}

/** spawnSync without shell so paths with spaces (e.g. repo folder name) are not split on Windows. */
function runExec(label, file, args, env = process.env) {
  console.log(`\n━━━ ${label} ━━━\n`);
  const result = spawnSync(file, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env,
  });
  return result.status ?? 1;
}

if (process.env.PREFLIGHT_SKIP_RUNTIME_CHECK !== "1") {
  const rt = path.join(root, "stress-test", "scripts", "check-test-runtime.cjs");
  if (fs.existsSync(rt)) {
    const code = runExec("Node 20 + esbuild native runtime", process.execPath, [rt, "esbuild"]);
    if (code !== 0) {
      process.exit(code);
    }
  }
}

{
  const code = run(
    "turbo: lint + typecheck + test",
    "pnpm",
    ["exec", "turbo", "run", "lint", "typecheck", "test", "--continue"],
  );
  if (code !== 0) {
    process.exit(code);
  }
}

process.exit(0);
