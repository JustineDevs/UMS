#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const isWin = process.platform === "win32";

console.error(
  "[dev:parallel] Starting without Medusa health ordering. Storefront, admin, and API may boot before Medusa is healthy.",
);

const child = spawn("pnpm", ["exec", "turbo", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: isWin,
  env: process.env,
});

child.on("error", (error) => {
  console.error(`[dev:parallel] Failed to start turbo dev: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal === "SIGINT" || signal === "SIGTERM") {
    process.exit(0);
  }
  process.exit(code ?? 0);
});
