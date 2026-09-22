#!/usr/bin/env node
/**
 * Run Playwright E2E tests with transform cache and temp dir in project directory.
 * Avoids EPERM when these would otherwise be written to Cursor's install path.
 *
 * Also tees the full Playwright CLI stdout/stderr to
 * `stress-test/test-results/runtime-logs/<runId>/playwright-cli-raw.log` and sets
 * `E2E_RUNTIME_LOG_DIR` so the custom reporter writes worker stdio and NDJSON events
 * into the same folder.
 */
const path = require("path");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const { attach } = require("./lib/runtime-log-tee.cjs");
attach(__filename);

const projectRoot = path.resolve(__dirname, "..", "..");

process.env.NODE_ENV = process.env.NODE_ENV ?? "development";
// Browser verification is intentionally isolated from production quotas. Local
// E2E must never spend or exhaust a shared Upstash request budget.
if (process.env.NODE_ENV !== "production") {
  process.env.UVS_DISABLE_REMOTE_RATE_LIMIT = "1";
}

const stressTestDir = path.join(projectRoot, "stress-test");
const cacheDir = path.join(stressTestDir, ".playwright-cache");
const tmpDir = path.join(cacheDir, "tmp");

fs.mkdirSync(tmpDir, { recursive: true });

process.env.PWTEST_CACHE_DIR = cacheDir;
process.env.TMP = tmpDir;
process.env.TEMP = tmpDir;
process.env.TMPDIR = tmpDir;

const args = process.argv.slice(2);
const cli = path.join(projectRoot, "node_modules", "@playwright", "test", "cli.js");

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runtimeLogDir = path.join(stressTestDir, "test-results", "runtime-logs", runId);
fs.mkdirSync(runtimeLogDir, { recursive: true });

const env = {
  ...process.env,
  PWTEST_CACHE_DIR: cacheDir,
  TMP: tmpDir,
  TEMP: tmpDir,
  TMPDIR: tmpDir,
  E2E_RUNTIME_LOG_DIR: runtimeLogDir,
};

const logPath = path.join(runtimeLogDir, "playwright-cli-raw.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });
const header = `# playwright-cli-raw.log started ${new Date().toISOString()}\n# cwd ${projectRoot}\n# args ${JSON.stringify(args)}\n`;
logStream.write(header);

function runChild(execPath, argv, useShell) {
  const child = spawn(execPath, argv, {
    cwd: projectRoot,
    env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: useShell,
  });
  let terminating = false;

  // Playwright owns the web-server children. Forward interrupts so it can
  // terminate the unified dev stack instead of leaving Next/API descendants
  // behind when the test runner is stopped or crashes.
  const forwardSignal = (signal) => {
    if (terminating) return;
    terminating = true;
    child.kill(signal);
    spawnSync(process.execPath, [path.join(projectRoot, "scripts/cleanup-dev-runtime.cjs")], {
      cwd: projectRoot,
      stdio: "ignore",
      timeout: 15_000,
    });
    const forceKill = setTimeout(() => child.kill("SIGKILL"), 10_000);
    forceKill.unref();
  };
  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.stdout.on("data", (d) => {
    process.stdout.write(d);
    logStream.write(d);
  });
  child.stderr.on("data", (d) => {
    process.stderr.write(d);
    logStream.write(d);
  });
  child.on("close", (code, signal) => {
    const tail = `\n# playwright-cli-raw.log ended code=${code} signal=${signal ?? ""} at ${new Date().toISOString()}\n`;
    logStream.write(tail, () => {
      logStream.close(() => {
        process.exit(code ?? 1);
      });
    });
  });
  child.on("error", (err) => {
    logStream.write(`\n# spawn error ${err}\n`);
    console.error(err);
    logStream.close(() => process.exit(1));
  });
}

function probeHttp(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 1200 }, (response) => {
      response.resume();
      resolve((response.statusCode ?? 500) < 400);
    });
    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function configureExistingStackReuse() {
  if (process.env.PLAYWRIGHT_SKIP_WEBSERVER) return;
  if (process.env.CI || process.env.PLAYWRIGHT_SERVER_MODE === "production") return;

  const storefrontBase = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
  const workerBase = process.env.PLAYWRIGHT_WORKER_URL || "http://127.0.0.1:8787";
  const [storefrontReady, workerReady] = await Promise.all([
    probeHttp(`${storefrontBase}/api/health`),
    probeHttp(`${workerBase}/healthz`),
  ]);

  if (storefrontReady && workerReady) {
    process.env.PLAYWRIGHT_SKIP_WEBSERVER = "1";
    console.log(
      "[run-e2e] Reusing the healthy local Worker + storefront stack; no duplicate dev servers will be started.",
    );
  }
}

configureExistingStackReuse().then(() => {
  if (fs.existsSync(cli)) {
    runChild(process.execPath, [cli, "test", ...args], false);
  } else {
    runChild("npx", ["playwright", "test", ...args], true);
  }
}).catch((error) => {
  console.error("[run-e2e] Failed to inspect the local stack before starting Playwright:", error);
  process.exit(1);
});
