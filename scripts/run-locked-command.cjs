#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const { acquire, release } = require("./uvs-runtime-lock.cjs");

const [, , mode, ...rawArgs] = process.argv;
if (!mode || rawArgs[0] !== "--" || rawArgs.length < 2) {
  console.error("Usage: node scripts/run-locked-command.cjs <mode> -- <command> [args...]");
  process.exit(2);
}

let shell = false;
const args = rawArgs.slice(1);
if (args[0] === "--shell") {
  shell = true;
  args.shift();
}

try {
  acquire(mode);
} catch (error) {
  console.error(`[${mode}] ${error.message}`);
  process.exit(1);
}

const child = spawn(shell ? args.join(" ") : args[0], shell ? [] : args.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  shell,
  stdio: "inherit",
  detached: process.platform !== "win32",
});
let stopping = false;

function stop(signal) {
  if (stopping) return;
  stopping = true;
  try {
    if (child.pid && process.platform !== "win32") process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    // The command may have exited already.
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("error", (error) => {
  console.error(`[${mode}] ${error.message}`);
  release();
  process.exit(1);
});
child.on("close", (code, signal) => {
  release();
  process.exit(code ?? (signal ? 1 : 0));
});
