/**
 * Starts Medusa in Docker first, waits until /health responds, then starts API/storefront/admin
 * in parallel with prefixed logs. Avoids frontend/admin racing ahead of the commerce API.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
import { config as loadDotenv } from "dotenv";
import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const isWin = process.platform === "win32";
const composeFile = join(root, "docker-compose.medusa.yml");
loadRootEnv();
const composeProjectName =
  process.env.MEDUSA_DOCKER_PROJECT_NAME?.trim() ||
  "universal-music-store-medusa";

const requiredEnv = ["DATABASE_URL", "NEXT_PUBLIC_MEDUSA_URL"];
const runtimeDir = join(root, ".uvs-dev-runtime");
const runtimeLockPath = join(runtimeDir, "dev-supervisor.json");
// The admin compiles the shared workspace graph plus route-specific dashboards. Keep
// Next's protective restart guard enabled, but give it enough bounded headroom to avoid
// restarting between normal route smoke checks.
const nodeHeapMb = Number(process.env.UVS_DEV_NODE_MAX_OLD_SPACE_MB || 2048);
const adminHeapMb = Number(
  // Keep the dev server below the host's available memory while allowing the
  // admin route graph to compile without Next's 80% heap restart threshold.
  process.env.UVS_DEV_ADMIN_NODE_MAX_OLD_SPACE_MB || 6144,
);
const healthUrl =
  process.env.MEDUSA_DEV_HEALTH_URL?.trim() ||
  `${(
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_URL ||
    "http://localhost:9000"
  ).replace(/\/$/, "")}/health`;
const timeoutMs = Number(process.env.MEDUSA_DEV_WAIT_MS || 120_000);
const intervalMs = Number(process.env.MEDUSA_DEV_POLL_MS || 500);
const serviceSpecs = [
  { label: "api", args: ["--filter", "@universal-music-store/api", "dev"] },
  {
    label: "storefront",
    args: ["--filter", "@universal-music-store/storefront", "dev"],
  },
  { label: "admin", args: ["--filter", "@universal-music-store/admin", "dev"] },
];
const medusaDevArgs = ["--filter", "medusa", "dev"];
const dockerEnv = {
  ...process.env,
  MEDUSA_DOCKER_TARGET: process.env.MEDUSA_DOCKER_TARGET?.trim() || "dev",
  MEDUSA_DOCKER_ENV: process.env.MEDUSA_DOCKER_ENV?.trim() || "development",
  DOCKER_UID: String(process.getuid?.() ?? 1000),
  DOCKER_GID: String(process.getgid?.() ?? 1000),
};

/**
 * Env for Next.js + Express dev servers. Root `.env.local` often sets `NODE_ENV=production`
 * for deploy parity; that breaks `next dev` (PostCSS/Tailwind on `globals.css`, non-standard
 * NODE_ENV warnings). The Medusa child uses `apps/medusa/scripts/run-dev.cjs` which forces
 * development mode for `medusa develop`.
 */
function envForLocalWebApps(heapMb = nodeHeapMb) {
  return withDevHeap({
    ...process.env,
    NODE_ENV: "development",
  }, heapMb);
}

function spawnPnpm(args, options = {}) {
  return spawn("pnpm", args, {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    shell: isWin,
    detached: !isWin,
    env: process.env,
    ...options,
  });
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireRuntimeLock() {
  mkdirSync(runtimeDir, { recursive: true });
  try {
    const existing = JSON.parse(readFileSync(runtimeLockPath, "utf8"));
    if (Number.isInteger(existing.pid) && isPidAlive(existing.pid)) {
      exitWithError(
        `A development stack is already running (supervisor PID ${existing.pid}). ` +
          "Run pnpm cleanup:dev before starting another stack.",
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      rmSync(runtimeLockPath, { force: true });
    }
  }
  writeFileSync(
    runtimeLockPath,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + "\n",
    { flag: "w" },
  );
}

function releaseRuntimeLock() {
  try {
    const current = JSON.parse(readFileSync(runtimeLockPath, "utf8"));
    if (current.pid === process.pid) {
      rmSync(runtimeLockPath, { force: true });
    }
  } catch {
    rmSync(runtimeLockPath, { force: true });
  }
}

function stopChild(child, signal = "SIGTERM") {
  if (!child?.pid) return;
  try {
    if (!isWin) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    // The process may have exited between shutdown and group termination.
  }
}

function withDevHeap(env, heapMb = nodeHeapMb) {
  if (!Number.isFinite(heapMb) || heapMb <= 0) return env;
  const heapFlag = `--max-old-space-size=${Math.floor(heapMb)}`;
  const existing = env.NODE_OPTIONS?.trim() || "";
  return {
    ...env,
    NODE_OPTIONS: `${existing} ${heapFlag}`.trim(),
  };
}

function dockerComposeArgs(args) {
  return [
    "compose",
    "-f",
    composeFile,
    "--project-name",
    composeProjectName,
    ...args,
  ];
}

function assertDockerAvailable() {
  const result = spawnSync("docker", ["compose", "version"], {
    cwd: root,
    env: dockerEnv,
    encoding: "utf8",
    shell: isWin,
  });
  if (result.status === 0) {
    return;
  }
  return false;
}

function isDockerDaemonAvailable() {
  const result = spawnSync("docker", ["info"], {
    cwd: root,
    env: dockerEnv,
    encoding: "utf8",
    shell: isWin,
  });
  return result.status === 0;
}

function runDockerCompose(args) {
  const result = spawnSync("docker", dockerComposeArgs(args), {
    cwd: root,
    env: dockerEnv,
    encoding: "utf8",
    shell: isWin,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(" ")} failed`);
  }
}

function removeStaleMedusaContainer() {
  const result = spawnSync(
    "docker",
    [
      "ps",
      "-aq",
      "--filter",
      "label=com.universal-music-store.service=medusa",
    ],
    {
      cwd: root,
      env: dockerEnv,
      encoding: "utf8",
      shell: isWin,
    },
  );
  if (result.status !== 0) {
    return;
  }

  const ids = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return;
  }

  const rm = spawnSync("docker", ["rm", "-f", ...ids], {
    cwd: root,
    env: dockerEnv,
    encoding: "utf8",
    shell: isWin,
    stdio: "inherit",
  });
  if (rm.status !== 0) {
    throw new Error("failed to remove stale medusa container");
  }
}

function getMedusaContainerStatus() {
  const result = spawnSync(
    "docker",
    [
      "ps",
      "--filter",
      `name=${composeProjectName}-medusa-1`,
      "--format",
      "{{.Status}}",
    ],
    {
      cwd: root,
      env: dockerEnv,
      encoding: "utf8",
      shell: isWin,
    },
  );
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function statusNeedsFallback(status) {
  if (!status) return false;
  return /Restarting|Exited|Dead/i.test(status);
}

function statusLooksHealthy(status) {
  if (!status) return false;
  return /^Up\b/i.test(status);
}

async function waitForDockerMedusaToSettle(timeout = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const status = getMedusaContainerStatus();
    if (statusLooksHealthy(status)) {
      return true;
    }
    if (statusNeedsFallback(status)) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function exitWithError(message, code = 1) {
  console.error(`[dev] ${message}`);
  process.exit(code);
}

function loadRootEnv() {
  const envLocalPath = join(root, ".env.local");
  if (existsSync(envLocalPath)) {
    loadDotenv({ path: envLocalPath, override: true });
  }
}

function validateRequiredEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) {
    return;
  }
  exitWithError(
    `Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. ` +
      "Fill the root .env.local before running pnpm dev.",
  );
}

function pipeWithPrefix(stream, label, destination) {
  if (!stream) {
    return;
  }

  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      destination.write(`[${label}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (pending) {
      destination.write(`[${label}] ${pending}\n`);
      pending = "";
    }
  });
}

function wireChildLogging(child, label) {
  pipeWithPrefix(child.stdout, label, process.stdout);
  pipeWithPrefix(child.stderr, label, process.stderr);
}

async function waitForMedusaHealthy() {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3_000);
      const res = await fetch(healthUrl, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Medusa did not respond OK at ${healthUrl} within ${timeoutMs}ms. Fix Medusa errors in the log above, then retry.`,
  );
}

validateRequiredEnv();
acquireRuntimeLock();
process.on("exit", releaseRuntimeLock);

const dockerComposeInstalled = assertDockerAvailable() !== false;
const dockerDaemonAvailable = dockerComposeInstalled && isDockerDaemonAvailable();
const useDockerMedusa = dockerDaemonAvailable;

let dockerStarted = false;
let medusaChild = null;

try {
  if (useDockerMedusa) {
    removeStaleMedusaContainer();
    runDockerCompose(["up", "-d", "--build", "medusa"]);
    dockerStarted = true;
    const dockerHealthy = await waitForDockerMedusaToSettle();
    if (!dockerHealthy) {
      console.error(
        "[dev] Docker Medusa is restarting; falling back to native dev command.",
      );
      try {
        runDockerCompose(["stop", "-t", "10", "medusa"]);
      } catch {
        // Ignore cleanup failures while switching launch modes.
      }
      dockerStarted = false;
      medusaChild = spawnPnpm(medusaDevArgs, { env: withDevHeap(dockerEnv) });
      wireChildLogging(medusaChild, "medusa");
      medusaChild.on("error", (err) => {
        console.error(`[dev] failed to start medusa: ${err.message}`);
        process.exit(1);
      });
      medusaChild.on("exit", (code, sig) => {
        if (sig === "SIGINT" || sig === "SIGTERM") {
          process.exit(0);
        }
        if (code !== 0 && code !== null) {
          console.error(`[dev] medusa exited with code ${code}`);
          process.exit(code);
        }
      });
    }
  } else {
    console.error(
      "[dev] Docker daemon unavailable; starting Medusa with the native dev command instead.",
    );
    medusaChild = spawnPnpm(medusaDevArgs, { env: withDevHeap(dockerEnv) });
    wireChildLogging(medusaChild, "medusa");
    medusaChild.on("error", (err) => {
      console.error(`[dev] failed to start medusa: ${err.message}`);
      process.exit(1);
    });
    medusaChild.on("exit", (code, sig) => {
      if (sig === "SIGINT" || sig === "SIGTERM") {
        process.exit(0);
      }
      if (code !== 0 && code !== null) {
        console.error(`[dev] medusa exited with code ${code}`);
        process.exit(code);
      }
    });
  }
} catch (err) {
  exitWithError(
    `Failed to start Medusa Docker container: ${err instanceof Error ? err.message : String(err)}`,
  );
}

try {
  await waitForMedusaHealthy();
  console.error(
    `[dev] Medusa is up (${healthUrl}). Starting other dev servers...`,
  );
} catch (e) {
  console.error(`[dev] ${e.message}`);
  if (dockerStarted) {
    try {
      runDockerCompose(["logs", "--no-color", "--tail", "200", "medusa"]);
    } catch {
      // Ignore log retrieval failures; the health error above is enough to stop.
    }
  }
  if (dockerStarted) {
    try {
      runDockerCompose(["stop", "-t", "10", "medusa"]);
    } catch {
      // Ignore cleanup failures on startup failure.
    }
  }
  process.exit(1);
}

const children = [];
const rest = serviceSpecs.map(({ label, args }) => {
  const child = spawnPnpm(args, {
    env: envForLocalWebApps(label === "admin" ? adminHeapMb : nodeHeapMb),
  });
  wireChildLogging(child, label);
  child.on("error", (err) => {
    console.error(`[dev] failed to start ${label}: ${err.message}`);
    for (const running of children) {
      running.kill("SIGTERM");
    }
    process.exit(1);
  });
  children.push(child);
  return { label, child };
});

function shutdown(signal) {
  for (const child of children) {
    stopChild(child, signal);
  }
  if (medusaChild) {
    stopChild(medusaChild, signal);
  }
  if (dockerStarted) {
    try {
      runDockerCompose(["stop", "-t", "10", "medusa"]);
    } catch {
      // Ignore cleanup failures during shutdown.
    }
  }
  releaseRuntimeLock();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const { label, child } of rest) {
  child.on("exit", (code, sig) => {
    if (sig === "SIGINT" || sig === "SIGTERM") {
      shutdown("SIGTERM");
      process.exit(0);
    }
    if (code !== 0 && code !== null) {
      console.error(`[dev] ${label} exited with code ${code}`);
      shutdown("SIGTERM");
      process.exit(code);
    }
  });
}
