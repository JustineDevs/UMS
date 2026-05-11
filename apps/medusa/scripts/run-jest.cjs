/**
 * Cross-platform Jest runner: sets TEST_TYPE and NODE_OPTIONS (Windows-safe).
 * Usage: node scripts/run-jest.cjs <TEST_TYPE> [-- [jest args...]]
 * Example: node scripts/run-jest.cjs unit -- --silent --runInBand --forceExit
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { checkRuntime } = require(path.join(
  __dirname,
  "..",
  "..",
  "..",
  "stress-test",
  "scripts",
  "check-test-runtime.cjs",
));

const root = path.join(__dirname, "..");
/** Writable temp under the app (avoids EPERM when bundled Node uses a read-only install dir). */
const localTmp = path.join(root, ".jest-cache", "tmp");
try {
  fs.mkdirSync(localTmp, { recursive: true });
} catch {
  /* ignore */
}
process.env.TMP = localTmp;
process.env.TEMP = localTmp;
process.env.TMPDIR = localTmp;
const argv = process.argv.slice(2);
const dash = argv.indexOf("--");
const testType = argv[0];
const jestArgs = dash === -1 ? argv.slice(1) : argv.slice(dash + 1);

if (!testType) {
  console.error("Usage: node scripts/run-jest.cjs <TEST_TYPE> [-- [jest args]]");
  process.exit(1);
}

process.env.TEST_TYPE = testType;
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, "--experimental-vm-modules"]
  .filter(Boolean)
  .join(" ");
try {
  checkRuntime("swc", root);
} catch (error) {
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  console.error(`\n[run-jest] ${message}\n`);
  process.exit(1);
}

let jestEntry = null;
const resolveRoots = [root, path.join(root, ".."), path.join(root, "..", "..")];
for (const base of resolveRoots) {
  try {
    jestEntry = require.resolve("jest/bin/jest", { paths: [base] });
    break;
  } catch {
    /* try next */
  }
}
if (!jestEntry) {
  console.error("[run-jest] Could not resolve jest. Run pnpm install from the repo root.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [jestEntry, ...jestArgs], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

process.exit(result.status ?? 1);
