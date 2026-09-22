#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const generatedPaths = [
  "apps/web/.next",
  "apps/web/.next-production",
  ".turbo/cache",
  ".wrangler/tmp",
  "stress-test/test-results",
  "stress-test/playwright-report",
  "playwright-report",
  "test-results",
  ".uvs-dev-runtime",
];

function absolute(relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing path outside workspace: ${relativePath}`);
  }
  return resolved;
}

function size(relativePath) {
  const target = absolute(relativePath);
  if (!fs.existsSync(target)) return "0B";
  try {
    return execFileSync("du", ["-sh", "--", target], { encoding: "utf8" })
      .trim()
      .split(/\s+/, 1)[0];
  } catch {
    return "unavailable";
  }
}

function report() {
  console.log("Generated workspace output (safe-to-recreate only):");
  for (const relativePath of generatedPaths) {
    console.log(`${size(relativePath).padStart(12)}  ${relativePath}`);
  }
  console.log("Dependencies and package-manager caches are intentionally excluded.");
}

function prune() {
  let removed = 0;
  for (const relativePath of generatedPaths) {
    const target = absolute(relativePath);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed += 1;
    console.log(`Removed ${relativePath}`);
  }
  console.log(`Removed ${removed} generated path(s). Dependencies and shared caches were not touched.`);
}

const command = process.argv[2] ?? "report";
if (command === "report") report();
else if (command === "prune") prune();
else {
  console.error("Usage: node scripts/storage-maintenance.cjs [report|prune]");
  process.exitCode = 2;
}
