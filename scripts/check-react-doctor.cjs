#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const result = spawnSync(
  "pnpm",
  [
    "dlx",
    "react-doctor@0.9.11",
    "--json",
    "--no-score",
    "--no-telemetry",
    "--no-parallel",
    "--project",
    "@universal-music-store/admin,@universal-music-store/storefront",
    "--blocking",
    "error",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

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
  return !filePath.includes("/.next/") && !filePath.startsWith(".next/");
});
const summary = report.summary || {};
const errorCount = diagnostics.filter((item) => item.severity === "error").length;
console.log(
  `[react-doctor] ${diagnostics.length} diagnostics: ${errorCount} errors, ${diagnostics.filter((item) => item.severity === "warning").length} warnings`,
);

for (const diagnostic of diagnostics.filter(
  (item) => item.severity === "error",
)) {
  console.error(
    `[react-doctor] ${diagnostic.filePath}:${diagnostic.line ?? 0} ${diagnostic.rule}: ${diagnostic.message}`,
  );
}

// React Doctor returns a non-zero status when its configured blocking mode
// sees diagnostics, including warnings. This wrapper intentionally blocks only
// on source-level errors; warnings remain visible in CI output for triage.
process.exit(errorCount > 0 ? 1 : 0);
