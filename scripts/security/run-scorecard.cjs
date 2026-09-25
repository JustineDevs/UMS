#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const target = process.argv[2] ?? "github.com/JustineDevs/UMS";
const scorecard = process.env.SCORECARD_BIN ?? "scorecard";
const args =
  target === "--local"
    ? ["--local", process.argv[3] ?? ".", "--show-details"]
    : ["--repo", target, "--show-details"];

const result = spawnSync(scorecard, args, {
  stdio: "inherit",
  env: process.env,
});

if (result.error?.code === "ENOENT") {
  console.error(
    `Scorecard CLI not found: ${scorecard}. Install it from https://github.com/ossf/scorecard/blob/main/README.md#scorecard-command-line-interface or set SCORECARD_BIN.`,
  );
  process.exit(127);
}

if (result.error) {
  console.error(`Scorecard CLI failed to start: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
