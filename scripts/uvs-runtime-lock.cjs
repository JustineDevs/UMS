#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const runtimeDir = path.join(projectRoot, ".uvs-dev-runtime");
const lockPath = path.join(runtimeDir, "runtime-lock.json");

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function processGroupId(pid = process.pid) {
  if (process.platform !== "linux") return pid;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const marker = stat.lastIndexOf(") ");
    return Number(stat.slice(marker + 2).split(" ")[2]) || pid;
  } catch {
    return pid;
  }
}

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}

function describe(lock) {
  return `${lock.mode} session (PID ${lock.pid}, process group ${lock.pgid})`;
}

function acquire(mode, details = {}) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const existing = readLock();
  if (existing && Number.isInteger(existing.pid) && isAlive(existing.pid)) {
    throw new Error(
      `UVS is already owned by ${describe(existing)}. ` +
        `Stop it with pnpm cleanup:dev before starting ${mode}.`,
    );
  }
  if (existing) fs.rmSync(lockPath, { force: true });

  const lock = {
    pid: process.pid,
    pgid: processGroupId(),
    mode,
    projectRoot,
    startedAt: new Date().toISOString(),
    ...details,
  };
  let fd;
  try {
    fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(fd, `${JSON.stringify(lock)}\n`);
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    const raced = readLock();
    if (raced && isAlive(raced.pid)) {
      throw new Error(`UVS is already owned by ${describe(raced)}.`);
    }
    throw error;
  }
  fs.closeSync(fd);
  return lock;
}

function update(details) {
  const current = readLock();
  if (!current || current.pid !== process.pid) return;
  fs.writeFileSync(lockPath, `${JSON.stringify({ ...current, ...details })}\n`);
}

function release() {
  const current = readLock();
  if (current?.pid === process.pid) fs.rmSync(lockPath, { force: true });
  try {
    if (fs.readdirSync(runtimeDir).length === 0) fs.rmdirSync(runtimeDir);
  } catch {
    // Another process may be creating or removing the runtime directory.
  }
}

function assertAvailable(mode) {
  const existing = readLock();
  if (existing && isAlive(existing.pid)) {
    throw new Error(
      `Cannot start ${mode}: UVS is already owned by ${describe(existing)}.`,
    );
  }
  if (existing) fs.rmSync(lockPath, { force: true });
}

module.exports = {
  acquire,
  assertAvailable,
  getLockPath: () => lockPath,
  processGroupId,
  readLock,
  release,
  update,
};
