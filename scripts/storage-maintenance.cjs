#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const removablePaths = [
  ".turbo",
  ".tmp",
  ".uvs-dev-runtime",
  "tmp",
  "coverage",
  "playwright-report",
  "test-results",
  "stress-test/playwright-report",
  "stress-test/test-results",
  "stress-test/blob-report",
  "stress-test/release-gate-logs",
  "stress-test/checkout-provider-stress-logs",
  "stress-test/dogfood-output",
  "apps/admin/.next",
  "apps/admin/.next-production",
  "apps/storefront/.next",
  "apps/storefront/.next-production",
  "apps/api/.next",
  "apps/medusa/.medusa",
];

function bytesFor(target) {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  for (const entry of fs.readdirSync(target)) total += bytesFor(path.join(target, entry));
  return total;
}

function formatBytes(bytes) {
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const apply = process.argv.includes("--apply");
const existing = removablePaths
  .map((relative) => ({ relative, absolute: path.join(root, relative) }))
  .filter(({ absolute }) => fs.existsSync(absolute))
  .map(({ relative, absolute }) => ({ relative, absolute, bytes: bytesFor(absolute) }));

if (existing.length === 0) {
  console.log("[storage] No tracked generated output needs cleanup.");
  process.exit(0);
}

let reclaimed = 0;
let blocked = 0;
for (const entry of existing) {
  console.log(`[storage] ${apply ? "Removing" : "Would remove"} ${entry.relative} (${formatBytes(entry.bytes)})`);
  if (apply) {
    try {
      fs.rmSync(entry.absolute, { recursive: true, force: true });
      reclaimed += entry.bytes;
    } catch (error) {
      blocked += 1;
      console.warn(`[storage] Could not remove ${entry.relative}: ${error.code ?? "unknown error"}`);
    }
  }
}

console.log(
  `[storage] ${apply ? "Reclaimed" : "Potentially reclaimable"} ${formatBytes(
    apply ? reclaimed : existing.reduce((sum, entry) => sum + entry.bytes, 0),
  )}.`,
);
if (blocked > 0) {
  console.warn(`[storage] ${blocked} path(s) need ownership repair before they can be cleaned.`);
  process.exitCode = 2;
}
if (!apply) console.log("[storage] This was a dry run. Use `pnpm storage:prune` to apply it.");
