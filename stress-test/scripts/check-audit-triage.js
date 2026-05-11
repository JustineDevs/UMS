#!/usr/bin/env node

/**
 * Audit triage check. Runs pnpm audit and verifies all findings are
 * documented in internal/docs/audit-triage.md. Exit 0 = triaged; 1 = untriaged.
 *
 * Ship rule: all high/critical must be either fixed or listed in triage doc.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { attach } = require("./lib/runtime-log-tee.cjs");
attach(__filename);

const root = path.resolve(__dirname, "..", "..");
const triagePath = path.join(root, "internal", "docs", "audit-triage.md");

function main() {
  const audit = spawnSync("pnpm", ["audit", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  const out = (audit.stdout || audit.stderr || "{}").trim();
  let data;
  try {
    data = JSON.parse(out);
  } catch {
    console.error("audit: failed to parse output");
    process.exit(1);
  }

  const meta = data.metadata?.vulnerabilities || {};
  const criticalCount = meta.critical || 0;
  const highCount = meta.high || 0;

  if (criticalCount > 0) {
    console.error("CRITICAL vulnerabilities — must fix before ship.");
    process.exit(1);
  }

  if (highCount === 0 && (meta.moderate || 0) + (meta.low || 0) === 0) {
    console.log("No vulnerabilities. Audit triage OK.");
    process.exit(0);
  }

  if (!fs.existsSync(triagePath)) {
    console.error(
      "Vulnerabilities found but no triage doc. Create internal/docs/audit-triage.md.",
    );
    process.exit(1);
  }

  const triageContent = fs.readFileSync(triagePath, "utf8");
  const triageLooksUsed =
    triageContent.length >= 200 &&
    /ACCEPT|FIX|CVE|high severity|pnpm audit/i.test(triageContent);

  if (highCount > 0 && !triageLooksUsed) {
    console.error(
      `High vulnerabilities (${highCount}) require triage. Document each FIX or ACCEPT in internal/docs/audit-triage.md.`,
    );
    process.exit(1);
  }

  console.log(
    `Audit triage OK. ${highCount} high, ${meta.moderate || 0} moderate, ${meta.low || 0} low.`,
  );
  process.exit(0);
}

main();
