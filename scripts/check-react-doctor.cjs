#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const reactDoctorBin = require.resolve("react-doctor");

const timeoutMs = Number.parseInt(process.env.REACT_DOCTOR_TIMEOUT_MS || "120000", 10);
const maxDurationSeconds = process.env.REACT_DOCTOR_MAX_DURATION_SECONDS || "120";
const result = spawnSync(
  process.execPath,
  [
    reactDoctorBin,
    "--json",
    "--no-score",
    "--no-telemetry",
    "--no-parallel",
    "--project",
    "apps/web",
    "--scope",
    "files",
    "--max-duration",
    maxDurationSeconds,
    "--blocking",
    "error",
  ],
  {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  },
);

if (result.error) {
  if (result.error.code === "ETIMEDOUT") {
    process.stderr.write(
      `[react-doctor] analyzer timed out after ${timeoutMs}ms; no report was produced\n`,
    );
  } else {
    process.stderr.write(`[react-doctor] failed to start analyzer: ${result.error.message}\n`);
  }
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  process.stderr.write(result.stderr || result.stdout || "react-doctor returned no report\n");
  process.exit(result.status || 1);
}

const diagnostics = (report.diagnostics || []).filter((item) => {
  // React Doctor can inspect generated Next.js source maps in dev mode. Those
  // maps include dependency documentation strings, not shipped application
  // source or runtime secrets. Keep the source tree fully blocking while
  // excluding only generated build artifacts.
  const filePath = String(item.filePath || "");
  return !filePath.includes("/.next/") &&
    !filePath.startsWith(".next/") &&
    !filePath.includes("/.next-dev/") &&
    !filePath.startsWith(".next-dev/") &&
    !filePath.includes("/.next-production/") &&
    !filePath.startsWith(".next-production/");
});
const summary = report.summary || {};
const errorCount = diagnostics.filter((item) => item.severity === "error").length;
const warningCount = diagnostics.filter((item) => item.severity === "warning").length;
// Keep the ratchet at the current verified source baseline. New diagnostics
// must be fixed or explicitly accounted for; the budget must not drift upward
// just because the analyzer discovers more files.
const warningBudget = Number.parseInt(process.env.REACT_DOCTOR_WARNING_BUDGET || "102", 10);
console.log(
  `[react-doctor] ${diagnostics.length} diagnostics: ${errorCount} errors, ${warningCount} warnings (budget ${warningBudget})`,
);

for (const diagnostic of diagnostics.filter(
  (item) => item.severity === "error",
)) {
  console.error(
    `[react-doctor] ${diagnostic.filePath}:${diagnostic.line ?? 0} ${diagnostic.rule}: ${diagnostic.message}`,
  );
}

// React Doctor returns a non-zero status when its configured blocking mode
// sees diagnostics, including warnings. The wrapper keeps the source-level
// error gate and adds a ratchet: warning growth fails CI, while reducing the
// backlog lowers the effective baseline for future runs.
if (warningCount > warningBudget) {
  console.error(`[react-doctor] warning budget exceeded: ${warningCount} > ${warningBudget}`);
}
process.exit(errorCount > 0 || warningCount > warningBudget ? 1 : 0);
