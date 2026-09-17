"use strict";

const { spawnSync } = require("node:child_process");

const [heapArg, command, ...args] = process.argv.slice(2);
const heapMb = Number(heapArg);
if (!Number.isInteger(heapMb) || heapMb < 256 || !command) {
  console.error(
    "Usage: node scripts/run-bounded-node.cjs <heap-mb> <command> [args...]",
  );
  process.exit(2);
}

const existingOptions = (process.env.NODE_OPTIONS || "")
  .replace(/(?:^|\s)--max-old-space-size=\S+/g, "")
  .replace(/\s+/g, " ")
  .trim();
const env = {
  ...process.env,
  NODE_OPTIONS: `${existingOptions} --max-old-space-size=${heapMb}`.trim(),
};
const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
