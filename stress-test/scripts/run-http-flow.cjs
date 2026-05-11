#!/usr/bin/env node
/**
 * HTTP matrix: defaults to PLAYWRIGHT_SKIP_WEBSERVER=1 so a local `pnpm dev` on 3000/3001
 * does not collide with Playwright trying to spawn another Next dev (EADDRINUSE).
 * Opt in to auto webServers: PLAYWRIGHT_SKIP_WEBSERVER=0 pnpm test:http-flow
 * or use pnpm test:http-flow:with-webservers.
 */
const path = require("path");
const { spawnSync } = require("child_process");
const { attach } = require("./lib/runtime-log-tee.cjs");
attach(__filename);

const projectRoot = path.resolve(__dirname, "..", "..");

if (process.env.PLAYWRIGHT_SKIP_WEBSERVER === undefined) {
  process.env.PLAYWRIGHT_SKIP_WEBSERVER = "1";
}

const runE2e = path.join(__dirname, "run-e2e.js");
const extra = process.argv.slice(2);
const args = [runE2e, "flows/http-flow-matrix.spec.ts", ...extra];

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  cwd: projectRoot,
  env: process.env,
});

process.exit(result.status ?? 1);
