#!/usr/bin/env node
/**
 * Back-compat wrapper. Prefer: pnpm stress-test:checkout-providers
 * or: node --import tsx/esm stress-test/scripts/stress-checkout-providers.ts
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attach } from "./lib/runtime-log-tee.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
attach(import.meta.url);
const root = path.resolve(__dirname, "..", "..");
const script = path.join(__dirname, "stress-checkout-providers.ts");
const r = spawnSync(
  "pnpm",
  ["exec", "tsx", script, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: root, env: process.env, shell: true },
);
process.exit(r.status ?? 1);
