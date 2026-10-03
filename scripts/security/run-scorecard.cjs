#!/usr/bin/env node

const { homedir } = require("node:os");
const { existsSync, accessSync, constants } = require("node:fs");
const { spawnSync } = require("node:child_process");

// pnpm forwards the conventional separator as a literal argument when this
// script is invoked as `pnpm security:scorecard -- --local .`.
const cliArgs = process.argv.slice(2);
if (cliArgs[0] === "--") cliArgs.shift();
const target = cliArgs[0] ?? "github.com/JustineDevs/UMS";
const configuredScorecard = process.env.SCORECARD_BIN?.trim();
const localScorecard = `${homedir()}/go/bin/scorecard`;
const scorecard = configuredScorecard ||
  (existsSync(localScorecard) && (() => {
    try {
      accessSync(localScorecard, constants.X_OK);
      return localScorecard;
    } catch {
      return undefined;
    }
  })()) ||
  "scorecard";
const args =
  target === "--local"
    ? ["--local", cliArgs[1] ?? ".", "--show-details"]
    : ["--repo", target, "--show-details"];

if (target !== "--local" && !process.env.GITHUB_AUTH_TOKEN && !process.env.GH_TOKEN) {
  console.error(
    "Scorecard remote scans require GITHUB_AUTH_TOKEN or GH_TOKEN; run `node scripts/security/run-scorecard.cjs --local .` for an unauthenticated checkout scan.",
  );
  process.exit(2);
}

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
