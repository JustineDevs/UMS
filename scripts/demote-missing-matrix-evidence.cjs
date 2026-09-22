#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const matrixFiles = [
  ".omx/context/full-task(4).md",
  ".omx/context/full-task(5).md",
  ".omx/context/full-task(6).md",
  ".omx/context/full-task(7).md",
  ".omx/context/full-task(8).md",
];
const evidenceDir = path.join(root, "artifacts/verification");
const evidenceIds = new Set(
  fs.readdirSync(evidenceDir).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)),
);
const statusPattern = /\|\s*`?VERIFIED`?\s*\|/gi;
const missing = [];

for (const relative of matrixFiles) {
  const file = path.join(root, relative);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let changed = false;
  const next = lines.map((line) => {
    const id = /^\|\s*([A-Z][A-Z0-9-]*-\d+)\s*\|/i.exec(line)?.[1];
    if (!id || evidenceIds.has(id)) return line;
    const matches = [...line.matchAll(statusPattern)];
    if (!matches.length) return line;
    const match = matches.at(-1);
    const start = match.index + match[0].indexOf("VERIFIED");
    const updated = `${line.slice(0, start)}NEEDS-VERIFICATION${line.slice(start + "VERIFIED".length)}`;
    changed = true;
    missing.push({ id, matrix: relative });
    return updated;
  });
  if (changed && process.env.APPLY === "1") fs.writeFileSync(file, next.join("\n"));
}

console.log(JSON.stringify({ mode: process.env.APPLY === "1" ? "applied" : "dry-run", count: missing.length, rows: missing }, null, 2));
