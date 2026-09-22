#!/usr/bin/env node
/**
 * Local CI preflight before commit automation: Node/native runtime check, then Turbo lint, typecheck, test.
 * Set PREFLIGHT_SKIP_RUNTIME_CHECK=1 to skip the native runtime check.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
// The web TypeScript graph needs more than 1 GiB on a cold cache. Keep the
// lower bound above the known OOM point while limiting concurrency separately.
const ciHeapMb = boundedInteger(
  "UVS_CI_MAX_OLD_SPACE_MB",
  process.env.UVS_CI_MAX_OLD_SPACE_MB,
  1536,
  8192,
  1536,
);
const ciConcurrency = boundedInteger(
  "UVS_CI_CONCURRENCY",
  process.env.UVS_CI_CONCURRENCY,
  1,
  4,
  1,
);

function boundedInteger(name, value, min, max, fallback) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= min && parsed <= max) return parsed;
  throw new Error(`${name} must be an integer between ${min} and ${max}; received ${JSON.stringify(value)}`);
}

function boundedEnvironment() {
  const nodeOptions = (process.env.NODE_OPTIONS || "")
    .replace(/(?:^|\s)--max-old-space-size=\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    ...process.env,
    NODE_OPTIONS: `${nodeOptions} --max-old-space-size=${ciHeapMb}`.trim(),
    TURBO_CONCURRENCY: String(ciConcurrency),
    UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || "2",
  };
}

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
    [
      "exec",
      "turbo",
      "run",
      "lint",
      "typecheck",
      "test",
      "--continue",
      `--concurrency=${ciConcurrency}`,
    ],
    boundedEnvironment(),
  );
  if (code !== 0) {
    process.exit(code);
  }
}

process.exit(0);
