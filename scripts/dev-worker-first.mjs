/**
 * Start the local Worker/storefront stack without legacy API or container
 * processes. Database access is provided to the Worker through
 * the local Hyperdrive connection-string environment variables.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { config as loadDotenv } from "dotenv";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(root, ".uvs-dev-runtime");
const lockPath = join(runtimeDir, "dev-supervisor.json");
const require = createRequire(import.meta.url);
const runtimeLock = require("./uvs-runtime-lock.cjs");
const workerPort = Number(process.env.CLOUDFLARE_DEV_PORT || 8787);
const workerHealthUrl = `http://127.0.0.1:${workerPort}/healthz`;
const children = [];
let shuttingDown = false;

if (existsSync(join(root, ".env.local"))) {
  // Keep explicit process overrides authoritative. This is important for
  // sandbox/provider verification: a live value in .env.local must not
  // silently replace PAYPAL_ENVIRONMENT=sandbox supplied for a test run.
  loadDotenv({ path: join(root, ".env.local"), override: false });
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  runtimeLock.acquire("dev", { webPort: 3000, workerPort });
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
}

function releaseLock() {
  try {
    const current = JSON.parse(readFileSync(lockPath, "utf8"));
    if (current.pid === process.pid) rmSync(lockPath, { force: true });
  } catch {
    rmSync(lockPath, { force: true });
  }
  runtimeLock.release();
}

function withHeap(env, heapMb) {
  const option = `--max-old-space-size=${heapMb}`;
  const existing = (env.NODE_OPTIONS || "")
    .replace(/(?:^|\s)--max-old-space-size=\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { ...env, NODE_OPTIONS: `${existing} ${option}`.trim() };
}

function localWebEnv(heapMb) {
  return withHeap({ ...process.env, NODE_ENV: "development" }, heapMb);
}

function localWorkerEnv() {
  return {
    ...localWebEnv(768),
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_MEDUSA_HYPERDRIVE:
      process.env.MEDUSA_DB_URL ?? "",
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_APP_HYPERDRIVE:
      process.env.APP_DB_URL ?? "",
  };
}

function spawnPnpm(args, env) {
  const child = spawn("pnpm", args, {
    cwd: root,
    env,
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
    stdio: ["inherit", "pipe", "pipe"],
  });
  children.push(child);
  runtimeLock.update({
    children: children.filter((item) => item.pid).map((item) => item.pid),
    childGroups: children
      .filter((item) => item.pid)
      .map((item) => runtimeLock.processGroupId(item.pid)),
  });
  const prefix = `[${args.at(-1) === "dev" ? args[1] : "worker"}]`;
  for (const [stream, output] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    stream?.setEncoding("utf8");
    stream?.on("data", (chunk) => {
      for (const line of String(chunk).split(/\r?\n/))
        if (line) output.write(`${prefix} ${line}\n`);
    });
  }
  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${args.join(" ")}: ${error.message}`);
    void shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0 && signal === null) {
      console.error(`[dev] ${args.join(" ")} exited with code ${code}`);
      void shutdown(code || 1);
    }
  });
  return child;
}

async function waitForWorker() {
  const deadline =
    Date.now() + Number(process.env.CLOUDFLARE_DEV_WAIT_MS || 120_000);
  while (Date.now() < deadline) {
    try {
      const response = await fetch(workerHealthUrl);
      if (response.ok) return;
    } catch {
      // The Worker is still compiling or starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Cloudflare Worker did not respond at ${workerHealthUrl} within the startup timeout.`,
  );
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      if (child.pid && process.platform !== "win32")
        process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {
      // The child may already have exited.
    }
  }
  releaseLock();
  if (code !== 0) process.exitCode = code;
}

acquireLock();
process.on("exit", releaseLock);
process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

const worker = spawnPnpm(
  [
    "exec",
    "wrangler",
    "dev",
    "--config",
    "wrangler.jsonc",
    "--env",
    "dev",
    "--local",
    "--show-interactive-dev-session=false",
    "--ip",
    "127.0.0.1",
    "--port",
    String(workerPort),
    "--inspector-port",
    "0",
  ],
  localWorkerEnv(),
);
spawnPnpm(["--filter", "@universal-music-store/web", "dev"], localWebEnv(1536));

try {
  await waitForWorker();
  console.error(
    `[dev] Worker is ready at ${workerHealthUrl}; storefront is starting.`,
  );
  await new Promise((resolve) => {
    const keepAlive = setInterval(() => {}, 60_000);
    const stop = () => {
      clearInterval(keepAlive);
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
} catch (error) {
  console.error(
    `[dev] ${error instanceof Error ? error.message : String(error)}`,
  );
  await shutdown(1);
}

void worker;
