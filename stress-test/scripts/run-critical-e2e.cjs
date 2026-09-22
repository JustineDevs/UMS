#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const cleanup = () => spawnSync("pnpm", ["cleanup:dev"], {
  cwd: root,
  shell: true,
  stdio: "inherit",
});

function run(label, specs, extraEnv = {}) {
  console.log(`\n━━━ ${label} ━━━`);
  const env = { ...process.env, PLAYWRIGHT_SERVER_MODE: "production", PLAYWRIGHT_WORKERS: "1", ...extraEnv };
  if (!extraEnv.UVS_E2E_LOCAL) delete env.UVS_E2E_LOCAL;
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", ...specs, "--project=chromium", "--workers=1"],
    { cwd: root, shell: true, stdio: "inherit", env },
  );
  return result.status ?? 1;
}

const commerce = [
  "stress-test/e2e/flows/full-commerce-journey.spec.ts",
  "stress-test/e2e/flows/psp-checkout-cod.spec.ts",
];
const security = [
  "stress-test/e2e/smoke/storefront-api-security.spec.ts",
  "stress-test/e2e/smoke/admin-access.spec.ts",
];

let failed = cleanup().status !== 0;
if (run("Critical commerce and admin E2E (local deterministic identity)", commerce, {
  UVS_E2E_LOCAL: "1",
  CLOUDFLARE_DEV_PORT: "8787",
}) !== 0) failed = true;
if (cleanup().status !== 0) failed = true;
if (run("Critical API security E2E (real auth boundary)", security, {
  CLOUDFLARE_DEV_PORT: "8788",
  UVS_E2E_BOTID_BYPASS: "1",
}) !== 0) failed = true;
if (cleanup().status !== 0) failed = true;

process.exit(failed ? 1 : 0);
