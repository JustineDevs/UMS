"use strict";

const path = require("node:path");
const fs = require("node:fs");
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

function findNextBinPath(appDirectory, workspaceRoot) {
  const appNextBin = path.join(
    appDirectory,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  if (existsSync(appNextBin)) {
    return appNextBin;
  }

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

function portOwnerPids(port) {
  if (isWin) return [];
  const result = spawnSync("sh", ["-lc", `owners=$(lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true); if [ -n "$owners" ]; then printf '%s\\n' "$owners"; else fuser -n tcp ${port} 2>/dev/null || true; fi`], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
  const output = String(result.stdout ?? "");
  const fuserMatch = output.match(/:\s*(.*)$/s);
  const pidText = fuserMatch ? fuserMatch[1] : output;
  return pidText
    .trim()
    .split(/\s+/)
    .filter((value) => /^\d+$/.test(value))
    .map(Number);
}

function isWorkspaceProcess(pid) {
  try {
    const cwd = fs.realpathSync(`/proc/${pid}/cwd`);
    const command = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
    return cwd === root || cwd.startsWith(`${root}${path.sep}`) || command.includes(root);
  } catch {
    return false;
  }
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

  if (!isWin) {
    const owners = portOwnerPids(port);
    if (owners.length === 0 || owners.some((pid) => !isWorkspaceProcess(pid))) {
      console.error(
        `[next-dev] Port ${port} is occupied by a process outside UVS. ` +
          "Stop that application or choose a different development port; it was not terminated.",
      );
      process.exit(1);
    }
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

const nextBin = findNextBinPath(appDir, root);
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
const configuredPublicOrigin = process.env.UVS_DEV_PUBLIC_ORIGIN?.trim();
// Webpack is the stable default for the two-process Worker + Next dev stack.
// Turbopack can race its generated manifest writes when Wrangler reloads the
// Worker while a dynamic API route is compiling, leaving the storefront with
// an HTTP 500 until the generated directory is rebuilt. Keep Turbopack opt-in
// for contributors who explicitly want it.
const requestedBundler = String(process.env.UVS_DEV_NEXT_BUNDLER || "webpack").trim().toLowerCase();
if (requestedBundler !== "turbo" && requestedBundler !== "webpack") {
  console.error("UVS_DEV_NEXT_BUNDLER must be either turbo or webpack");
  process.exit(1);
}
const appEnv = {
  ...process.env,
  NODE_ENV: normalizedNodeEnv,
  BABEL_ENV: normalizedNodeEnv,
  ...(normalizedNodeEnv === "development"
    ? { NEXT_PUBLIC_SITE_URL: configuredPublicOrigin || localAuthOrigin }
    : {}),
};
const webHeapMb = Number(process.env.UVS_DEV_WEB_MAX_OLD_SPACE_MB || 1536);
if (!Number.isInteger(webHeapMb) || webHeapMb < 256) {
  console.error("UVS_DEV_WEB_MAX_OLD_SPACE_MB must be an integer of at least 256 MB");
  process.exit(1);
}
const existingNodeOptions = (appEnv.NODE_OPTIONS || "")
  .replace(/(?:^|\s)--max-old-space-size=\S+/g, "")
  .replace(/\s+/g, " ")
  .trim();
appEnv.NODE_OPTIONS = `${existingNodeOptions} --max-old-space-size=${webHeapMb}`.trim();

const nextArgs = [nextBin, "dev", "--port", String(port)];
if (requestedBundler === "turbo") {
  nextArgs.splice(2, 0, "--turbo");
}
const result = spawnSync(
  process.execPath,
  nextArgs,
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
