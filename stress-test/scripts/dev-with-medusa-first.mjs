/**
 * Starts Medusa first, waits until /health responds, then starts API/storefront/admin
 * in parallel with prefixed logs. Avoids frontend/admin racing ahead of the commerce API.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
import { config as loadDotenv } from "dotenv";
import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const isWin = process.platform === "win32";

const requiredEnv = ["DATABASE_URL", "NEXT_PUBLIC_MEDUSA_URL"];
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
  { label: "api", args: ["--filter", "@apparel-commerce/api", "dev"] },
  { label: "storefront", args: ["--filter", "@apparel-commerce/storefront", "dev"] },
  { label: "admin", args: ["--filter", "@apparel-commerce/admin", "dev"] },
];

/**
 * Env for Next.js + Express dev servers. Root `.env` often sets `NODE_ENV=production`
 * for deploy parity; that breaks `next dev` (PostCSS/Tailwind on `globals.css`, non-standard
 * NODE_ENV warnings). The Medusa child uses `apps/medusa/scripts/run-dev.cjs` which forces
 * development mode for `medusa develop`.
 */
function envForLocalWebApps() {
  return {
    ...process.env,
    NODE_ENV: "development",
  };
}

function spawnPnpm(args, options = {}) {
  return spawn("pnpm", args, {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    shell: isWin,
    env: process.env,
    ...options,
  });
}

function exitWithError(message, code = 1) {
  console.error(`[dev] ${message}`);
  process.exit(code);
}

function loadRootEnv() {
  const envPath = join(root, ".env");
  const envLocalPath = join(root, ".env.local");
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: false });
  }
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
      "Fill the root .env before running pnpm dev.",
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

loadRootEnv();
validateRequiredEnv();
const medusa = spawnPnpm(["--filter", "medusa", "dev"]);
wireChildLogging(medusa, "medusa");

let medusaExited = false;
let medusaExitCode = 0;

medusa.on("error", (err) => {
  console.error("[dev] failed to start medusa:", err.message);
  process.exit(1);
});

medusa.on("exit", (code) => {
  medusaExited = true;
  medusaExitCode = code ?? 1;
});

try {
  await waitForMedusaHealthy();
  console.error(`[dev] Medusa is up (${healthUrl}). Starting other dev servers...`);
} catch (e) {
  if (medusaExited) {
    console.error(`[dev] Medusa exited before becoming healthy (code ${medusaExitCode}).`);
  }
  console.error(`[dev] ${e.message}`);
  medusa.kill("SIGTERM");
  process.exit(1);
}

const children = [medusa];
const rest = serviceSpecs.map(({ label, args }) => {
  const child = spawnPnpm(args, { env: envForLocalWebApps() });
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
    child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

medusa.on("exit", (code, sig) => {
  if (sig === "SIGINT" || sig === "SIGTERM") {
    process.exit(0);
  }
  if (code !== 0 && code !== null) {
    console.error(`[dev] medusa exited with code ${code}`);
    shutdown("SIGTERM");
    process.exit(code);
  }
});

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
