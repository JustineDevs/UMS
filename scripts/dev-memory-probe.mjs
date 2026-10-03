#!/usr/bin/env node

/**
 * Bounded development-process probe.
 *
 * Usage:
 *   node scripts/dev-memory-probe.mjs -- pnpm dev
 *
 * The probe is intentionally a separate wrapper so it cannot affect deployed
 * Vercel/Worker runtimes. It samples the spawned process tree and forwards the
 * child output while counting Fast Refresh/full-reload signals.
 */
import { execFile, spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { promisify } from "node:util";
import process from "node:process";

const execFileAsync = promisify(execFile);

const separator = process.argv.indexOf("--");
const command = separator >= 0 ? process.argv.slice(separator + 1) : [];
if (command.length === 0) {
  console.error("Usage: node scripts/dev-memory-probe.mjs -- <command> [args...]");
  process.exit(2);
}

const intervalMs = clampInteger(process.env.UVS_MEMORY_PROBE_INTERVAL_MS, 5000, 1000, 60000);
const durationMs = clampInteger(process.env.UVS_MEMORY_PROBE_DURATION_MS, 15 * 60 * 1000, 60000, 60 * 60 * 1000);
const maxTotalRssMiB = clampInteger(
  process.env.UVS_MEMORY_PROBE_MAX_TOTAL_RSS_MIB,
  6000,
  512,
  32 * 1024,
);
const startedAt = Date.now();
const samples = [];
const counters = { fastRefresh: 0, fullReload: 0, errors: 0 };
let stopping = false;

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function log(record) {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`;
  process.stdout.write(line);
  const outputFile = process.env.UVS_MEMORY_PROBE_OUTPUT_FILE?.trim();
  if (outputFile) {
    try {
      appendFileSync(outputFile, line, "utf8");
    } catch (error) {
      process.stderr.write(
        `[memory-probe] unable to persist ${outputFile}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }
}

function trackOutput(chunk) {
  const text = String(chunk);
  if (/fast refresh|hmr|hot update/i.test(text)) counters.fastRefresh += 1;
  if (/full reload|reloading page/i.test(text)) counters.fullReload += 1;
  if (/\b(error|fatal|oom|out of memory)\b/i.test(text)) counters.errors += 1;
}

async function processSnapshot(pid) {
  const descendants = new Set([pid]);
  let procEntries;
  try {
    procEntries = await readdir("/proc");
  } catch {
    return [];
  }
  const parents = new Map();
  await Promise.all(
    procEntries
      .filter((entry) => /^\d+$/.test(entry))
      .map(async (entry) => {
        try {
          const stat = await readFile(`/proc/${entry}/stat`, "utf8");
          const close = stat.lastIndexOf(")");
          const fields = stat.slice(close + 2).split(" ");
          parents.set(Number(entry), Number(fields[1]));
        } catch {
          // Processes may exit between readdir and stat.
        }
      }),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const [child, parent] of parents) {
      if (descendants.has(parent) && !descendants.has(child)) {
        descendants.add(child);
        changed = true;
      }
    }
  }
  // `pnpm dev` may place the actual Next/Worker stack in the transient
  // `uvs-dev.scope` cgroup. Those processes are intentionally not descendants
  // of this probe process, so include the scope members or the RSS evidence
  // would only describe the small launcher and under-report production-like
  // development memory.
  try {
    const { stdout } = await execFileAsync("systemctl", [
      "--user",
      "show",
      "uvs-dev.scope",
      "--property=ControlGroup",
      "--value",
    ]);
    const controlGroup = stdout.trim();
    if (controlGroup.startsWith("/")) {
      const cgroupProcesses = await readFile(`/sys/fs/cgroup${controlGroup}/cgroup.procs`, "utf8");
      for (const entry of cgroupProcesses.split(/\s+/)) {
        if (/^\d+$/.test(entry)) descendants.add(Number(entry));
      }
    }
  } catch {
    // systemd/cgroup support is optional; the ordinary process tree remains
    // the portable fallback on non-systemd hosts and CI runners.
  }
  return Promise.all(
    [...descendants].map(async (processId) => {
      try {
        const [status, comm] = await Promise.all([
          readFile(`/proc/${processId}/status`, "utf8"),
          readFile(`/proc/${processId}/comm`, "utf8"),
        ]);
        const rss = Number(status.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1] ?? 0) * 1024;
        const heap = Number(status.match(/^VmData:\s+(\d+)\s+kB$/m)?.[1] ?? 0) * 1024;
        return { pid: processId, command: comm.trim(), rssBytes: rss, dataBytes: heap };
      } catch {
        return null;
      }
    }),
  ).then((items) => items.filter(Boolean));
}

const child = spawn(command[0], command.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  detached: process.platform !== "win32",
  stdio: ["inherit", "pipe", "pipe"],
});

for (const [stream, output] of [
  [child.stdout, process.stdout],
  [child.stderr, process.stderr],
]) {
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk) => {
    trackOutput(chunk);
    output.write(chunk);
  });
}

async function sample() {
  const processes = await processSnapshot(child.pid);
  const totalRssBytes = processes.reduce((total, item) => total + item.rssBytes, 0);
  const record = {
    elapsedMs: Date.now() - startedAt,
    rootPid: child.pid,
    totalRssBytes,
    totalRssMiB: Math.round((totalRssBytes / 1024 / 1024) * 10) / 10,
    processes,
    counters: { ...counters },
  };
  samples.push(record);
  log({ type: "sample", ...record });
  if (record.totalRssMiB >= maxTotalRssMiB) {
    stop("rss-threshold", 1);
  }
}

const timer = setInterval(() => void sample(), intervalMs);
const deadline = setTimeout(() => stop("duration"), durationMs);

function stop(reason, code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  clearTimeout(deadline);
  if (child.exitCode === null && child.signalCode === null) {
    try {
      if (process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  const peak = samples.reduce((max, sample) => Math.max(max, sample.totalRssBytes), 0);
  log({
    type: "summary",
    reason,
    durationMs: Date.now() - startedAt,
    peakRssMiB: Math.round((peak / 1024 / 1024) * 10) / 10,
    samples: samples.length,
    counters,
    maxTotalRssMiB,
  });
  process.exitCode = code;
}

child.once("error", (error) => {
  log({ type: "error", message: error.message });
  stop("spawn-error", 1);
});
child.once("exit", (code, signal) => stop(`child-exit:${code ?? signal ?? "unknown"}`, code ?? 1));
process.once("SIGINT", () => stop("interrupt"));
process.once("SIGTERM", () => stop("terminate"));
void sample();
