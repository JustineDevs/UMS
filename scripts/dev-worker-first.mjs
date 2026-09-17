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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(root, ".uvs-dev-runtime");
const lockPath = join(runtimeDir, "dev-supervisor.json");
const workerPort = Number(process.env.CLOUDFLARE_DEV_PORT || 8787);
const workerHealthUrl = `http://127.0.0.1:${workerPort}/healthz`;
const children = [];
let shuttingDown = false;

if (existsSync(join(root, ".env.local"))) {
  loadDotenv({ path: join(root, ".env.local"), override: true });
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
  mkdirSync(runtimeDir, { recursive: true });
  try {
    const existing = JSON.parse(readFileSync(lockPath, "utf8"));
    if (Number.isInteger(existing.pid) && isAlive(existing.pid)) {
      throw new Error(
        `A development stack is already running (PID ${existing.pid}). Run pnpm cleanup:dev first.`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      !error.message.startsWith("A development stack")
    ) {
      rmSync(lockPath, { force: true });
    } else if (error instanceof Error) {
      throw error;
    }
  }
  writeFileSync(
    lockPath,
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
  );
}

function releaseLock() {
  try {
    const current = JSON.parse(readFileSync(lockPath, "utf8"));
    if (current.pid === process.pid) rmSync(lockPath, { force: true });
  } catch {
    rmSync(lockPath, { force: true });
  }
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
    "--port",
    String(workerPort),
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
