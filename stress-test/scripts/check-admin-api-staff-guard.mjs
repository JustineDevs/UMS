#!/usr/bin/env node
/**
 * Fails if a unified web App Router API route.ts lacks an obvious auth guard pattern.
 * Allowlisted routes use Supabase Auth callbacks, HMAC webhooks, or internal keys.
 */
import fs from "node:fs";
import path from "node:path";
import { attach } from "./lib/runtime-log-tee.mjs";

attach(import.meta.url);
const root = process.cwd();
const apiRoots = ["admin", "integrations", "cron", "pos", "webhooks", "medusa"].map(
  (segment) => path.join(root, "apps", "web", "src", "app", "api", segment),
);

const ALLOWLIST = new Set([
  path.join(root, "apps", "web", "src", "app", "api", "auth", "callback", "route.ts"),
  path.join(root, "apps", "web", "src", "app", "api", "auth", "session", "route.ts"),
  path.join(root, "apps", "web", "src", "app", "api", "integrations", "channels", "webhook", "route.ts"),
]);

const GUARD_RES = [
  /\brequireStaffSession\b/,
  /\brequireStaffApiSession\b/,
  /\bgetAdminSession\s*\(/,
  /\bstaffSessionAllows\b/,
  /\bINTERNAL_CHAT_INTAKE_KEY\b/,
  /\bx-internal-key\b/i,
  /\bgateChannelWebhookSecretConfigured\b/,
  /x-nango-hmac-sha256/i,
  /CRON_SECRET|CAMPAIGN_CRON_SECRET|x-cron-secret/i,
  /createHmac\(/,
  /proxyWorkerPublicRoute\(/,
];
const workerAdminProxyPath = path.join(root, "apps", "web", "src", "lib", "worker-admin-route-proxy.ts");
const workerAdminProxy = fs.readFileSync(workerAdminProxyPath, "utf8");
const workerAdminProxyIsAuthenticated =
  /getAdminSession\(\)/.test(workerAdminProxy) &&
  /if\s*\(!session\)[\s\S]*?status:\s*401/.test(workerAdminProxy) &&
  /createInternalWorkerAdminToken\(session\)/.test(workerAdminProxy) &&
  /Authorization:\s*`Bearer \$\{token\}`/.test(workerAdminProxy);
const workerAdminBridgePath = path.join(root, "apps", "web", "src", "lib", "worker-admin-bridge.ts");
const workerAdminBridge = fs.readFileSync(workerAdminBridgePath, "utf8");
function workerAdminBridgeHelper(name) {
  const start = workerAdminBridge.indexOf(`async function ${name}(`);
  if (start < 0) return "";
  const end = workerAdminBridge.indexOf("\n}", start);
  return end < 0 ? "" : workerAdminBridge.slice(start, end + 2);
}
const workerAdminBridgeEntryPointsAreAuthenticated = [
  "workerAdminRequest",
  "workerAdminMutation",
  "workerAdminCsvMutation",
].every((name) => {
  const helper = workerAdminBridgeHelper(name);
  return /const session = await getAdminSession\(\)/.test(helper) &&
    /if\s*\(!session\)[\s\S]*?status:\s*401/.test(helper) &&
    /createInternalWorkerAdminToken\(session\)/.test(helper) &&
    /Authorization:\s*`Bearer \$\{token\}`/.test(helper);
});
const workerAdminBridgeIsAuthenticated =
  workerAdminBridgeEntryPointsAreAuthenticated &&
  /async function createInternalWorkerAdminToken\(/.test(workerAdminBridge) &&
  /process\.env\.JWT_SECRET\?\.trim\(\)/.test(workerAdminBridge) &&
  /resolveStaffOrganization\(supabase,\s*email\)/.test(workerAdminBridge) &&
  /organization_id:\s*organization\.id/.test(workerAdminBridge) &&
  /permissions:\s*session\.user\.permissions\s*\?\?\s*\[\]/.test(workerAdminBridge) &&
  /createHmac\("sha256",\s*secret\)/.test(workerAdminBridge) &&
  /tryCreateSupabaseClient\(\)/.test(workerAdminBridge) &&
  /if\s*\(!supabase\)\s*return null/.test(workerAdminBridge) &&
  /if\s*\(!email\s*\|\|\s*!userId\)/.test(workerAdminBridge) &&
  /Authorization:\s*`Bearer \$\{token\}`/.test(workerAdminBridge);
const workerAdminBridgeCall = /\b(?:mutate|update|fetch|save|delete|bulkDelete|publish)Worker[A-Z][A-Za-z0-9]*ForAdmin\s*\(/;
const workerCronProxyPath = path.join(root, "apps", "web", "src", "lib", "worker-cron-proxy.ts");
const workerCronProxy = fs.readFileSync(workerCronProxyPath, "utf8");
const workerCronProxyIsAuthenticated =
  /if\s*\(!authorization\s*&&\s*!cronSecret\)[\s\S]*?status:\s*401/.test(workerCronProxy) &&
  /process\.env\.API_URL/.test(workerCronProxy) &&
  /\/internal\/cron\/\$\{encodeURIComponent\(task\)\}/.test(workerCronProxy) &&
  /Authorization:\s*authorization/.test(workerCronProxy) &&
  /"x-cron-secret":\s*cronSecret/.test(workerCronProxy);
const workerCronHandlerPath = path.join(root, "workers", "backend", "src", "cron.ts");
const workerCronHandler = fs.readFileSync(workerCronHandlerPath, "utf8");
const workerCronHandlerIsAuthenticated =
  /request\.method\s*!==\s*"GET"[\s\S]*?method_not_allowed/.test(workerCronHandler) &&
  /env\.CRON_SECRET\?\.trim\(\)/.test(workerCronHandler) &&
  /equalSecret\(configured,\s*provided\)/.test(workerCronHandler) &&
  /if\s*\(!configured\s*\|\|\s*!provided\s*\|\|\s*!\(await equalSecret/.test(workerCronHandler);

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
for (const file of apiRoots.flatMap((apiRoot) => walkRoutes(apiRoot))) {
  if (ALLOWLIST.has(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const ok = GUARD_RES.some((re) => re.test(text)) ||
    (/proxyWorkerAdminRoute\(/.test(text) && workerAdminProxyIsAuthenticated) ||
    (workerAdminBridgeCall.test(text) && workerAdminBridgeIsAuthenticated) ||
    (/proxyCronToWorker\(/.test(text) && workerCronProxyIsAuthenticated && workerCronHandlerIsAuthenticated);
  if (!ok) {
    console.error(
      `[admin-api-guard] Missing staff/internal guard pattern: ${path.relative(root, file)}`,
    );
    failed = true;
  }
}

if (failed) {
  console.error(
    "[admin-api-guard] Add a validated staff, internal, HMAC, or authenticated Worker proxy boundary.",
  );
  process.exit(1);
}
console.log("[admin-api-guard] admin API routes OK");
