#!/usr/bin/env node
/**
 * Fails if any "use client" storefront module imports server-only commerce secrets
 * or medusa admin HTTP helpers (prevents accidental bundle leaks).
 */
import fs from "node:fs";
import path from "node:path";
import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);

const root = path.join(process.cwd(), "apps", "storefront", "src");
const badPatterns = [
  /medusa-admin-fetch/,
  /from ["']@\/lib\/medusa-admin-fetch["']/,
  /MEDUSA_SECRET_API_KEY/,
  /MEDUSA_SECRET(?!_)/,
  /MEDUSA_ADMIN_API_SECRET/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /NEXT_PUBLIC_[A-Z0-9_]*SECRET/i,
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name.name)) out.push(p);
  }
  return out;
}

let failed = false;
for (const file of walk(root)) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes('"use client"') && !text.includes("'use client'")) continue;
  for (const re of badPatterns) {
    if (re.test(text)) {
      console.error(`[client-boundary] ${path.relative(process.cwd(), file)} matches ${re}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log("[client-boundary] storefront client modules OK");
