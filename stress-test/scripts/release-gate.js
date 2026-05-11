#!/usr/bin/env node

/**
 * Release gate — runs all automatable checks from the Same-Day Release Board.
 * Exit 0 = all gates pass. Exit 1 = at least one gate failed.
 *
 * Gates:
 *  1. Static / policy / security blockers
 *  2. Unit / route-logic / shared state-transition tests
 *  3. Explicit critical browser suites (only with --include-e2e)
 *
 * Truth contract:
 *  - `release-gate` proves static and logic-level regression resistance only.
 *  - `release-gate:full` adds the explicit browser suites in `pnpm test:e2e:critical`.
 *  - Provider sandbox connectivity, screenshots, and advisory jobs are separate and must not be confused with paid-order truth.
 *
 * Optional DB prep: `pnpm e2e:prep:medusa` skips Medusa seed when the store API already has products; `pnpm e2e:ensure-staff` no-ops if the staff user already exists.
 * For admin E2E credentials (local dev): root .env ADMIN_ALLOWED_EMAILS (first email) + NEXTAUTH_SECRET; run `pnpm e2e:ensure-staff`.
 * Playwright sets NEXTAUTH_URL per app (storefront 3000, admin 3001) so admin sign-in works even when root .env only lists the storefront URL.
 *
 * Full run report (`pnpm release-gate:full`): raw logs are written under stress-test/release-gate-logs/
 *   - release-gate-full-latest.log (overwritten each run)
 *   - release-gate-full-<ISO-timestamp>.log (history)
 * Disable file report: --no-report
 *
 * Usage: node stress-test/scripts/release-gate.js [--include-e2e] [--no-report]
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { attach } = require("./lib/runtime-log-tee.cjs");
attach(__filename);

const root = path.resolve(__dirname, "..", "..");
const includeE2e = process.argv.includes("--include-e2e");
const noReport = process.argv.includes("--no-report");
const recordReport = includeE2e && !noReport;

const nodeMajor = parseInt(process.version.slice(1).split(".")[0], 10);
if (nodeMajor !== 20) {
  console.error(
    `\n🛑 Release gate requires Node 20. Current: ${process.version}. Use nvm use 20 or .nvmrc.\n`,
  );
  process.exit(1);
}

/** Raw log buffer for full report (child output + banners). */
const reportChunks = [];

function emit(s) {
  process.stdout.write(s);
  if (recordReport) {
    reportChunks.push(typeof s === "string" ? s : String(s));
  }
}

function emitLine(s) {
  emit(s + (s.endsWith("\n") ? "" : "\n"));
}

function flushReportFiles() {
  if (!recordReport || reportChunks.length === 0) return;
  const dir = path.join(root, "stress-test", "release-gate-logs");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const latestPath = path.join(dir, "release-gate-full-latest.log");
  const datedPath = path.join(dir, `release-gate-full-${stamp}.log`);
  const body = reportChunks.join("");
  const footer = `\n\n━━━ Log file paths ━━━\n${latestPath}\n${datedPath}\n`;
  const full = body + footer;
  fs.writeFileSync(latestPath, full, "utf8");
  fs.writeFileSync(datedPath, full, "utf8");
  process.stdout.write(
    `\n━━━ Full raw report written ━━━\n${latestPath}\n${datedPath}\n`,
  );
}

function run(gateName, cmd, args = []) {
  const [program, ...rest] = cmd;
  const fullCmd = [program, ...rest, ...args].join(" ");
  emitLine("");
  emitLine(`━━━ ${gateName} ━━━`);
  emitLine(`$ ${fullCmd}`);
  const result = spawnSync(program, [...rest, ...args], {
    cwd: root,
    shell: true,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const out = [result.stdout, result.stderr].filter(Boolean).join("");
  if (out) emit(out);
  const code = result.status;
  emitLine(`[exit ${code}] ${gateName}`);
  return code;
}

function main() {
  let failed = false;

  const started = new Date().toISOString();
  emitLine("=== Release gate ===");
  emitLine(`Started: ${started}`);
  emitLine(`Node: ${process.version}`);
  emitLine(`CWD: ${root}`);
  emitLine(`Args: ${process.argv.slice(2).join(" ") || "(none)"}`);
  if (recordReport) {
    emitLine(
      "Report: stress-test/release-gate-logs/release-gate-full-latest.log (+ timestamped copy)",
    );
  }
  emitLine("");
  emitLine("🚦 Release gate — blocking validation only");
  emitLine("Matrix: docs/validation-truth-matrix.md");

  const checks = [
    { name: "Lint", cmd: ["pnpm", "lint"] },
    { name: "Build (turbo)", cmd: ["pnpm", "build"] },
    { name: "Security (sensitive files)", cmd: ["pnpm", "security:check"] },
    {
      name: "Audit (triage check; see internal/docs/audit-triage.md)",
      cmd: ["node", "stress-test/scripts/check-audit-triage.js"],
    },
    {
      name: "Storefront client / secret boundary",
      cmd: ["node", "stress-test/scripts/check-storefront-client-boundary.mjs"],
    },
    {
      name: "Supabase migrations (no parallel commerce tables)",
      cmd: ["node", "stress-test/scripts/check-commerce-migration-boundary.mjs"],
    },
    {
      name: "Admin API route staff / internal guards",
      cmd: ["node", "stress-test/scripts/check-admin-api-staff-guard.mjs"],
    },
    {
      name: "Unit / integration / Medusa / database",
      cmd: ["pnpm", "test"],
    },
  ];

  for (const { name, cmd } of checks) {
    const code = run(name, cmd);
    if (code !== 0) {
      emitLine(`❌ ${name} failed (exit ${code})`);
      failed = true;
    }
  }

  if (includeE2e) {
    const code = run("Critical E2E (Playwright)", ["pnpm", "test:e2e:critical"]);
    if (code !== 0) {
      emitLine("❌ Critical E2E failed");
      failed = true;
    }
  } else {
    emitLine("");
    emitLine(
      "⏭️  Critical browser suites skipped. `pnpm release-gate` does not claim hosted payment or order-truth proof.",
    );
  }

  emitLine("");
  emitLine(`Finished: ${new Date().toISOString()}`);
  emitLine(`Result: ${failed ? "FAILED" : "PASSED"}`);
  emitLine("=== End release gate ===");

  if (failed) {
    emitLine("");
    emitLine("🛑 Release gate FAILED. Do not ship.");
  } else if (includeE2e) {
    emitLine("");
    emitLine("✅ Release gate passed (static + logic + selected browser business-proof suites).");
  } else {
    emitLine("");
    emitLine(
      "✅ Release gate passed for static + logic blockers only. Run pnpm release-gate:full for browser business-proof before ship.",
    );
  }

  if (recordReport) {
    flushReportFiles();
  }

  if (failed) {
    process.stderr.write("\n🛑 Release gate FAILED. Do not ship.\n");
    process.exit(1);
  }
  process.exit(0);
}

main();
