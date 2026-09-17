#!/usr/bin/env node
"use strict";

const { existsSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const requiredPackages = [
  {
    name: "@universal-music-store/platform-data",
    output: join(root, "packages", "platform-data", "dist", "index.js"),
  },
  {
    name: "@universal-music-store/sdk",
    output: join(root, "packages", "sdk", "dist", "index.js"),
  },
];

for (const required of requiredPackages) {
  if (existsSync(required.output)) continue;
  console.error(`[workspace] Building missing package output: ${required.name}`);
  const result = spawnSync("pnpm", ["--filter", required.name, "build"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
