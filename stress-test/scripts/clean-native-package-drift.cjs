#!/usr/bin/env node

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SUPPORTED_PLATFORMS = new Set(["linux", "win32", "darwin"]);
const NON_TARGET_TOKENS = [
  "android",
  "freebsd",
  "openbsd",
  "netbsd",
  "sunos",
  "aix",
  "openharmony",
];
const TARGET_PREFIXES = ["@swc+core-", "@rollup+rollup-", "@esbuild+"];

function parseArgs(argv) {
  const out = {
    cwd: process.cwd(),
    dryRun: false,
    platform: process.platform,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (arg.startsWith("--platform=")) {
      out.platform = arg.slice("--platform=".length).trim();
      continue;
    }
    if (arg.startsWith("--cwd=")) {
      out.cwd = path.resolve(arg.slice("--cwd=".length).trim());
    }
  }
  return out;
}

function normalizePlatform(platform) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(
      `Unsupported platform "${platform}". Expected one of: ${[
        ...SUPPORTED_PLATFORMS,
      ].join(", ")}`,
    );
  }
  return platform;
}

function packageDirLooksForeign(dirName, platform) {
  if (!TARGET_PREFIXES.some((prefix) => dirName.startsWith(prefix))) {
    return false;
  }

  if (NON_TARGET_TOKENS.some((token) => dirName.includes(token))) {
    return true;
  }

  const platformTokens = [...SUPPORTED_PLATFORMS].filter((token) =>
    dirName.includes(token),
  );
  if (platformTokens.length === 0) {
    return false;
  }
  return !platformTokens.includes(platform);
}

function listForeignPnpmDirs(pnpmDir, platform) {
  if (!fs.existsSync(pnpmDir)) {
    return [];
  }
  return fs
    .readdirSync(pnpmDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => packageDirLooksForeign(name, platform))
    .map((name) => path.join(pnpmDir, name));
}

function pnpmDirNameToNodeModulePath(rootDir, dirName) {
  if (dirName.startsWith("@swc+core-")) {
    return path.join(
      rootDir,
      "node_modules",
      "@swc",
      dirName.replace("@swc+", "").replace(/@.+$/, ""),
    );
  }
  if (dirName.startsWith("@rollup+rollup-")) {
    return path.join(
      rootDir,
      "node_modules",
      "@rollup",
      dirName.replace("@rollup+", "").replace(/@.+$/, ""),
    );
  }
  if (dirName.startsWith("@esbuild+")) {
    return path.join(
      rootDir,
      "node_modules",
      "@esbuild",
      dirName.replace("@esbuild+", "").replace(/@.+$/, ""),
    );
  }
  return null;
}

function uniqueExistingPaths(paths) {
  return [...new Set(paths)].filter((p) => p && fs.existsSync(p));
}

function collectForeignPaths(rootDir, platform) {
  const pnpmDir = path.join(rootDir, "node_modules", ".pnpm");
  const foreignPnpmDirs = listForeignPnpmDirs(pnpmDir, platform);
  const foreignNodeModuleDirs = uniqueExistingPaths(
    foreignPnpmDirs.map((abs) =>
      pnpmDirNameToNodeModulePath(rootDir, path.basename(abs)),
    ),
  );
  return [...foreignPnpmDirs, ...foreignNodeModuleDirs];
}

function isWindowsFsRemovalError(error, platform) {
  return (
    platform === "win32" &&
    Boolean(error) &&
    ["EPERM", "EACCES", "ENOTEMPTY", "EBUSY"].includes(error.code)
  );
}

function buildWindowsCleanupCommand(target) {
  const escaped = target.replace(/"/g, '""');
  return `if exist "${escaped}" rd /s /q "${escaped}" & if exist "${escaped}" del /f /q "${escaped}"`;
}

function buildWindowsPowerShellCommand(target) {
  const escaped = target.replace(/'/g, "''");
  return [
    "$ErrorActionPreference = 'Stop'",
    `$p = '${escaped}'`,
    "if (Test-Path -LiteralPath $p) {",
    "  Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop",
    "}",
  ].join("; ");
}

function removePathWindowsFallback(target, fsImpl, execFileSyncImpl) {
  try {
    execFileSyncImpl(
      "cmd.exe",
      ["/d", "/s", "/c", buildWindowsCleanupCommand(target)],
      { stdio: "ignore" },
    );
  } catch {
    // fall through to PowerShell fallback below
  }

  if (!fsImpl.existsSync(target)) {
    return;
  }

  try {
    execFileSyncImpl(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        buildWindowsPowerShellCommand(target),
      ],
      { stdio: "ignore" },
    );
  } catch {
    // final existence check below decides whether to fail
  }
}

function removePath(
  target,
  {
    dryRun = false,
    platform = process.platform,
    fsImpl = fs,
    execFileSyncImpl = childProcess.execFileSync,
  } = {},
) {
  if (dryRun) {
    return { ok: true, target };
  }
  try {
    fsImpl.rmSync(target, { recursive: true, force: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: true, target };
    }
    if (platform !== "win32") {
      throw error;
    }
  }
  if (!fsImpl.existsSync(target)) {
    return { ok: true, target };
  }
  if (platform === "win32") {
    removePathWindowsFallback(target, fsImpl, execFileSyncImpl);
    if (!fsImpl.existsSync(target)) {
      return { ok: true, target };
    }
    console.warn(
      `[clean-native-package-drift] could not remove (close Node/IDE, exclude folder from AV, or delete manually):\n  ${target}`,
    );
    return {
      ok: false,
      target,
      error: new Error("Path still present after fs.rm and shell cleanup"),
    };
  }
  throw new Error(`Failed to remove ${target}`);
}

function removePaths(paths, options) {
  const removed = [];
  const failed = [];
  for (const target of paths) {
    const result = removePath(target, options);
    if (result.ok) {
      removed.push(target);
    } else {
      failed.push({ path: target, message: result.error?.message ?? "locked or busy" });
    }
  }
  return { removed, failed };
}

function run(options) {
  const platform = normalizePlatform(options.platform);
  const rootDir = path.resolve(options.cwd);
  const paths = collectForeignPaths(rootDir, platform);
  const { removed, failed } = removePaths(paths, {
    dryRun: options.dryRun,
    platform,
  });
  return {
    cwd: rootDir,
    platform,
    dryRun: options.dryRun,
    removed,
    failed,
  };
}

if (require.main === module) {
  const { attach } = require("./lib/runtime-log-tee.cjs");
  attach(__filename);
  const result = run(parseArgs(process.argv.slice(2)));
  const nothing =
    result.removed.length === 0 &&
    (!result.failed || result.failed.length === 0);
  if (nothing && !result.dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          platform: result.platform,
          dryRun: result.dryRun,
          removed: [],
          failed: [],
          message: "No cross-platform native package drift found.",
        },
        null,
        2,
      ),
    );
  } else {
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  }
}

module.exports = {
  buildWindowsCleanupCommand,
  buildWindowsPowerShellCommand,
  collectForeignPaths,
  isWindowsFsRemovalError,
  packageDirLooksForeign,
  parseArgs,
  removePath,
  removePaths,
  run,
};
