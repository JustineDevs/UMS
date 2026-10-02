"use strict";

const { spawnSync } = require("node:child_process");
const { acquire, release } = require("./uvs-runtime-lock.cjs");

try {
  acquire("build");
} catch (error) {
  console.error(`[build] ${error.message}`);
  process.exit(1);
}
process.on("exit", release);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

// Keep production builds below the host's failure point when the desktop,
// browser, or emulator is already using several gigabytes. Override this
// explicitly only on a build-only machine with more memory available.
const heapMb = Number(process.env.UVS_BUILD_MAX_OLD_SPACE_MB || 1536);
if (!Number.isInteger(heapMb) || heapMb < 1024) {
  console.error(
    "[build] UVS_BUILD_MAX_OLD_SPACE_MB must be an integer of at least 1024 MB",
  );
  process.exit(1);
}

const existingOptions = (process.env.NODE_OPTIONS || "")
  .replace(/(?:^|\s)--max-old-space-size=\S+/g, "")
  .replace(/\s+/g, " ")
  .trim();
const env = {
  ...process.env,
  NODE_OPTIONS: `${existingOptions} --max-old-space-size=${heapMb}`.trim(),
};
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  pnpm,
  [
    "exec",
    "turbo",
    "build",
    "--filter=@universal-music-store/web...",
    "--concurrency=1",
  ],
  { cwd: process.cwd(), env, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
