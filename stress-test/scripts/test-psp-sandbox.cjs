/**
 * Standalone PSP sandbox connectivity runner.
 *
 * Runs the psp-sandbox-connectivity tests via the Medusa Jest config.
 *
 * Usage:  node stress-test/scripts/test-psp-sandbox.cjs
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const { attach } = require("./lib/runtime-log-tee.cjs");
attach(__filename);

const medusaRoot = path.join(__dirname, "..", "..", "apps", "medusa");
const localTmp = path.join(medusaRoot, ".jest-cache", "tmp");
try {
  fs.mkdirSync(localTmp, { recursive: true });
} catch {
  /* ignore */
}

process.env.TMP = localTmp;
process.env.TEMP = localTmp;
process.env.TMPDIR = localTmp;
process.env.TEST_TYPE = "unit";
process.env.NODE_OPTIONS = [
  process.env.NODE_OPTIONS,
  "--experimental-vm-modules",
]
  .filter(Boolean)
  .join(" ");

let jestEntry;
const resolveRoots = [
  medusaRoot,
  path.join(medusaRoot, ".."),
  path.join(medusaRoot, "..", ".."),
];
for (const base of resolveRoots) {
  try {
    jestEntry = require.resolve("jest/bin/jest", { paths: [base] });
    break;
  } catch {
    /* try next */
  }
}
if (!jestEntry) {
  console.error("[test-psp-sandbox] Could not resolve jest. Run pnpm install.");
  process.exit(1);
}

console.log("Running PSP sandbox connectivity tests...\n");

const result = spawnSync(
  process.execPath,
  [
    jestEntry,
    "--testPathPattern",
    "psp-sandbox-connectivity",
    "--verbose",
    "--forceExit",
    "--no-coverage",
  ],
  {
    stdio: "inherit",
    cwd: medusaRoot,
    env: process.env,
  },
);

process.exit(result.status ?? 1);
