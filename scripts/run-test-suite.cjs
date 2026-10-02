#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

const commands = [
  "node scripts/stress-test/tools/check-test-runtime.cjs esbuild",
  "pnpm --filter @universal-music-store/platform-data build",
  "pnpm --filter @universal-music-store/platform-data test",
  "pnpm --filter @universal-music-store/ui build",
  "pnpm --filter @universal-music-store/sdk build",
  "pnpm --filter @universal-music-store/sdk test",
  "pnpm --filter @universal-music-store/validation test",
  "pnpm --filter @universal-music-store/omnichannel-policy test",
  "pnpm --filter @universal-music-store/rate-limits test",
  "pnpm --filter @universal-music-store/database test",
  "pnpm --filter @universal-music-store/web exec node scripts/run-all-tests.cjs",
];
const result = spawnSync("node", ["scripts/run-locked-command.cjs", "test", "--", "--shell", commands.join(" && ")], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
