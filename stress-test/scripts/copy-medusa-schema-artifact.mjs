#!/usr/bin/env node
/**
 * Copies checked-in Medusa DDL artifact into output/medusa-audit for audits and diffs.
 * Source: internal/docs/exclusive/medusadb/schema.sql
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attach } from "./lib/runtime-log-tee.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
attach(import.meta.url);
const ROOT = path.resolve(__dirname, "..", "..");
const SRC = path.join(
  ROOT,
  "internal",
  "docs",
  "exclusive",
  "medusadb",
  "schema.sql",
);
const DEST_DIR = path.join(ROOT, "output", "medusa-audit");
const DEST = path.join(DEST_DIR, "medusa_schema.from_internal_artifact.sql");

if (!fs.existsSync(SRC)) {
  console.error("Missing Medusa schema artifact:", SRC);
  process.exit(1);
}
fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log("Wrote", DEST);
