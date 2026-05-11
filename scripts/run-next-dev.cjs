"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const appRel = process.argv[2];
const port = process.argv[3];

if (!appRel || !port) {
  console.error("Usage: node scripts/run-next-dev.cjs <app-rel-path> <port>");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const appDir = path.join(root, appRel);

const cleanTrace = spawnSync(
  process.execPath,
  [path.join(__dirname, "clean-next-trace.cjs"), appRel],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

if (cleanTrace.error) {
  throw cleanTrace.error;
}

if ((cleanTrace.status ?? 0) !== 0) {
  process.exit(cleanTrace.status ?? 1);
}

const nextBin = require.resolve("next/dist/bin/next", {
  paths: [appDir],
});

const currentNodeEnv = process.env.NODE_ENV?.trim();
const normalizedNodeEnv =
  currentNodeEnv === "development" ||
  currentNodeEnv === "production" ||
  currentNodeEnv === "test"
    ? currentNodeEnv
    : "development";

const result = spawnSync(
  process.execPath,
  [nextBin, "dev", "--port", String(port)],
  {
    cwd: appDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: normalizedNodeEnv,
      BABEL_ENV: normalizedNodeEnv,
    },
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
