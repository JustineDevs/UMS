"use strict";

const path = require("node:path");
const { existsSync, readdirSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const appRel = process.argv[2];
const port = process.argv[3];

if (!appRel || !port) {
  console.error("Usage: node scripts/run-next-dev.cjs <app-rel-path> <port>");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const appDir = path.join(root, appRel);
const isWin = process.platform === "win32";

function findNextBinPath(workspaceRoot) {
  const storeDir = path.join(workspaceRoot, "node_modules", ".pnpm");
  if (!existsSync(storeDir)) {
    return null;
  }

  const candidates = readdirSync(storeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("next@"))
    .map((entry) =>
      path.join(storeDir, entry.name, "node_modules", "next", "dist", "bin", "next"),
    )
    .filter((candidate) => existsSync(candidate));

  return candidates[0] ?? null;
}

function portIsListening(port) {
  const unixCheck = spawnSync(
    "sh",
    [
      "-lc",
      `lsof -tiTCP:${port} -sTCP:LISTEN >/dev/null 2>&1 || fuser -n tcp ${port} >/dev/null 2>&1`,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      shell: false,
    },
  );
  return (unixCheck.status ?? 1) === 0;
}

function freePort(port) {
  if (isWin) {
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `$p = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($p) { Stop-Process -Id $p -Force }`,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: process.env,
        shell: false,
      },
    );
    return result.status === 0;
  }

  const result = spawnSync("sh", ["-lc", `fuser -k -n tcp ${port} >/dev/null 2>&1 || true`], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
  return (result.status ?? 1) === 0;
}

function ensurePortFree(port) {
  if (!portIsListening(port)) {
    return;
  }

  console.error(`[next-dev] Port ${port} is busy. Clearing stale listener before startup.`);
  freePort(port);
}

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

const nextBin = findNextBinPath(root);
if (!nextBin) {
  console.error(
    "Unable to resolve Next.js binary from the pnpm store. Run pnpm install at the workspace root first.",
  );
  process.exit(1);
}

ensurePortFree(port);

const currentNodeEnv = process.env.NODE_ENV?.trim();
const normalizedNodeEnv =
  currentNodeEnv === "development" ||
  currentNodeEnv === "production" ||
  currentNodeEnv === "test"
    ? currentNodeEnv
    : "development";

const localAuthOrigin = `http://localhost:${port}`;
const appEnv = {
  ...process.env,
  NODE_ENV: normalizedNodeEnv,
  BABEL_ENV: normalizedNodeEnv,
  ...(normalizedNodeEnv === "development" ? { NEXTAUTH_URL: localAuthOrigin } : {}),
};

const result = spawnSync(
  process.execPath,
  [nextBin, "dev", "--port", String(port)],
  {
    cwd: appDir,
    stdio: "inherit",
    env: appEnv,
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
