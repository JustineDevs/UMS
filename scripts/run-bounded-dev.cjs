#!/usr/bin/env node
"use strict";

/**
 * Start the local stack with a host-level budget. Node heap limits alone do
 * not protect the workstation because Next, Wrangler, and native workers can
 * allocate outside V8's old-space heap.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entry = path.join(root, "scripts/dev-worker-first.mjs");
const memoryMaxMb = integerEnv("UVS_DEV_MEMORY_MAX_MB", 6144, 2048, 32 * 1024);
const minAvailableMb = integerEnv("UVS_DEV_MIN_AVAILABLE_MB", 4096, 1024, 32 * 1024);
const cpuQuota = integerEnv("UVS_DEV_CPU_QUOTA_PERCENT", 200, 100, 800);

function integerEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function availableMemoryMb() {
  if (process.platform !== "linux") return null;
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const availableKb = Number(meminfo.match(/^MemAvailable:\s+(\d+) kB$/m)?.[1]);
    return Number.isFinite(availableKb) ? Math.floor(availableKb / 1024) : null;
  } catch {
    return null;
  }
}

function hasCommand(command) {
  return spawnSync("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`], {
    stdio: "ignore",
  }).status === 0;
}

function canStartSystemdScope() {
  const result = spawnSync(
    "systemd-run",
    ["--user", "--scope", "--quiet", "--", "true"],
    { cwd: root, stdio: "ignore" },
  );
  return !result.error && result.status === 0;
}

function runDirect() {
  const result = spawnSync(process.execPath, [entry], {
    cwd: root,
    env: {
      ...process.env,
      UVS_DEV_MEMORY_MAX_MB: String(memoryMaxMb),
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

const availableMb = availableMemoryMb();
if (availableMb !== null && availableMb < minAvailableMb) {
  console.error(
    `[dev-budget] Refusing to start: only ${availableMb} MiB RAM is available; ` +
      `at least ${minAvailableMb} MiB is required. Stop stale dev/test processes first.`,
  );
  process.exit(1);
}

if (
  process.platform === "linux" &&
  process.env.UVS_DEV_NO_SYSTEMD !== "1" &&
  hasCommand("systemd-run") &&
  canStartSystemdScope()
) {
  const result = spawnSync(
    "systemd-run",
    [
      "--user",
      "--scope",
      "--unit=uvs-dev",
      `--property=MemoryMax=${memoryMaxMb}M`,
      `--property=CPUQuota=${cpuQuota}%`,
      "--property=TasksMax=512",
      "--collect",
      "--",
      process.execPath,
      entry,
    ],
    {
      cwd: root,
      env: { ...process.env, UVS_DEV_MEMORY_MAX_MB: String(memoryMaxMb) },
      stdio: "inherit",
    },
  );
  if (result.error) {
    console.warn(`[dev-budget] systemd scope failed to launch: ${result.error.message}`);
    runDirect();
  }
  process.exit(result.status ?? 1);
}

console.warn(
  `[dev-budget] systemd cgroup unavailable; Node heap limits remain active at ${memoryMaxMb} MiB.`,
);
runDirect();
