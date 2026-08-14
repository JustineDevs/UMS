#!/usr/bin/env node
/**
 * Fails if an apps/admin App Router API route.ts lacks an obvious auth guard pattern.
 * Allowlisted routes use NextAuth, HMAC webhooks, or internal keys instead of staff session.
 */
import fs from "node:fs";
import path from "node:path";
import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);
const root = process.cwd();
const apiRoot = path.join(root, "apps", "admin", "src", "app", "api");

const ALLOWLIST = new Set([
  path.join(apiRoot, "auth", "[...nextauth]", "route.ts"),
  path.join(apiRoot, "integrations", "channels", "webhook", "route.ts"),
]);

const GUARD_RES = [
  /\brequireStaffSession\b/,
  /\brequireStaffApiSession\b/,
  /\bgetServerSession\s*\(/,
  /\bstaffSessionAllows\b/,
  /\bINTERNAL_CHAT_INTAKE_KEY\b/,
  /\bx-internal-key\b/i,
  /\bgateChannelWebhookSecretConfigured\b/,
  /x-nango-hmac-sha256/i,
  /createHmac\(/,
];

function walkRoutes(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walkRoutes(p, out);
    else if (name.name === "route.ts") out.push(p);
  }
  return out;
}

let failed = false;
for (const file of walkRoutes(apiRoot)) {
  if (ALLOWLIST.has(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const ok = GUARD_RES.some((re) => re.test(text));
  if (!ok) {
    console.error(
      `[admin-api-guard] Missing staff/internal guard pattern: ${path.relative(root, file)}`,
    );
    failed = true;
  }
}

if (failed) {
  console.error(
    "[admin-api-guard] Add requireStaffSession, getServerSession, or documented internal/HMAC gate.",
  );
  process.exit(1);
}
console.log("[admin-api-guard] admin API routes OK");
