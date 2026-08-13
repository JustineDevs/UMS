#!/usr/bin/env node
"use strict";

/**
 * Stop only local development processes owned by this workspace.
 * Browser cleanup is deliberately limited to the temporary agent-browser
 * profile so the user's normal browser is never touched.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const portCleaner = path.join(projectRoot, "stress-test/scripts/kill-project-ports.js");
const runtimeLockPath = path.join(projectRoot, ".uvs-dev-runtime", "dev-supervisor.json");

function stopProcessGroup(pid) {
  if (process.platform !== "linux") return false;
  try {
    process.kill(-pid, "SIGTERM");
    return true;
  } catch {
    try {
      process.kill(pid, "SIGTERM");
      return true;
    } catch {
      return false;
    }
  }
}

function readProcessInfo(pid) {
  try {
    const command = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const marker = stat.lastIndexOf(") ");
    const fields = stat.slice(marker + 2).split(" ");
    return {
      pid,
      ppid: Number(fields[1]),
      pgid: Number(fields[2]),
      command,
    };
  } catch {
    return null;
  }
}

function stopWorkspaceDevProcesses() {
  if (process.platform !== "linux") return 0;
  const knownCommands = [
    "dev-with-medusa-first.mjs",
    "run-next-dev.cjs",
    "next dev --port",
    "tsx watch",
    "medusa develop",
    "--filter medusa dev",
  ];
  const entries = fs.readdirSync("/proc", { withFileTypes: true });
  const infos = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => readProcessInfo(Number(entry.name)))
    .filter(Boolean)
    .filter(
      (info) =>
        info.pid !== process.pid &&
        info.command.includes(projectRoot) &&
        knownCommands.some((pattern) => info.command.includes(pattern)),
    );
  const byParent = new Map();
  for (const info of infos) {
    const children = byParent.get(info.ppid) ?? [];
    children.push(info);
    byParent.set(info.ppid, children);
  }
  const targets = new Map();
  const collect = (info) => {
    if (targets.has(info.pid)) return;
    targets.set(info.pid, info);
    for (const child of byParent.get(info.pid) ?? []) collect(child);
  };
  for (const info of infos) collect(info);

  let stopped = 0;
  for (const info of [...targets.values()].reverse()) {
    if (info.pgid === info.pid && stopProcessGroup(info.pid)) {
      stopped += 1;
      continue;
    }
    try {
      process.kill(info.pid, "SIGTERM");
      stopped += 1;
    } catch {
      // The process may have exited between inspection and cleanup.
    }
  }
  return stopped;
}

try {
  const lock = JSON.parse(fs.readFileSync(runtimeLockPath, "utf8"));
  if (Number.isInteger(lock.pid) && lock.pid !== process.pid) {
    stopProcessGroup(lock.pid);
  }
} catch {
  // No active supervisor or the lock is stale.
}
try {
  fs.rmSync(runtimeLockPath, { force: true });
  fs.rmdirSync(path.dirname(runtimeLockPath));
} catch {
  // The supervisor may remove the lock concurrently.
}

const stoppedWorkspaceProcesses = stopWorkspaceDevProcesses();
if (stoppedWorkspaceProcesses > 0) {
  console.log(`[cleanup-dev] Stopped ${stoppedWorkspaceProcesses} stale workspace dev process(es).`);
}

spawnSync(process.execPath, [portCleaner], {
  cwd: projectRoot,
  stdio: "inherit",
});

const selfPid = String(process.pid);
if (process.platform !== "linux") {
  console.log("[cleanup-dev] Port cleanup completed; browser profile cleanup is Linux-only.");
  process.exit(0);
}

const procEntries = fs.readdirSync("/proc", { withFileTypes: true });
const targets = [];

for (const entry of procEntries) {
  if (!entry.isDirectory() || !/^\d+$/.test(entry.name) || entry.name === selfPid) {
    continue;
  }

  let command;
  try {
    command = fs.readFileSync(`/proc/${entry.name}/cmdline`, "utf8").replaceAll("\0", " ");
  } catch {
    continue;
  }

  const isAgentBrowser =
    command.includes("agent-browser-linux-x64") ||
    (command.includes("ms-playwright/") && command.includes("/tmp/agent-browser-chrome-"));

  if (isAgentBrowser) {
    targets.push(Number(entry.name));
  }
}

for (const pid of targets) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // The process may have exited between inspection and cleanup.
  }
}

console.log(`[cleanup-dev] Stopped ${targets.length} owned browser process(es).`);
