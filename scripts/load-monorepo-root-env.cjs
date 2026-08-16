/**
 * Load the repo-root env file into `process.env` before Next reads config.
 * Used by apps/storefront and apps/admin `next.config.*` only.
 *
 * Kept under `scripts/` (not `stress-test/`) so production and CI builds never depend on test-only paths.
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

/**
 * Apply vars from a root env file without letting `NODE_ENV` leak into the Next.js process.
 * Local repo `.env.local` stays on development defaults, while `.env.production` mirrors the
 * production host config. Letting dotenv overwrite the process value would still break
 * `next dev` / `next build` because Next manages its own mode.
 */
function envValueUnset(key) {
  const v = process.env[key];
  return v === undefined || String(v).trim() === "";
}

function readEnvFileUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function applyRootEnvFile(filePath, overrideExisting) {
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(readEnvFileUtf8(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "NODE_ENV") continue;
    if (overrideExisting) {
      if (String(value).trim() === "") {
        continue;
      }
      process.env[key] = value;
      continue;
    }
    if (envValueUnset(key)) {
      process.env[key] = value;
    }
  }
}

function loadMonorepoRootEnv(fromConfigDir) {
  const root = path.resolve(fromConfigDir, "../..");
  const envFileName =
    process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
  const envFilePath = path.join(root, envFileName);
  const invalidationKey = "STOREFRONT_INTERNAL_INVALIDATION_SECRET";
  const invalidationBefore = process.env[invalidationKey];
  // The app launcher owns NEXTAUTH_URL in local development so admin and storefront
  // never generate callbacks or cookies for each other's origin.
  const runtimeNextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  const runtimeSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const runtimeStorefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim();
  const runtimePublicStorefrontUrl = process.env.PUBLIC_STOREFRONT_URL?.trim();
  // Deployment/runtime variables must win over repository defaults. This is
  // also required by local multi-service verification, where the same bundle
  // is pointed at an explicitly selected Medusa port.
  applyRootEnvFile(envFilePath, false);
  if (runtimeNextAuthUrl) {
    process.env.NEXTAUTH_URL = runtimeNextAuthUrl;
  }
  if (runtimeSiteUrl) {
    process.env.NEXT_PUBLIC_SITE_URL = runtimeSiteUrl;
  }
  if (runtimeStorefrontUrl) {
    process.env.NEXT_PUBLIC_STOREFRONT_URL = runtimeStorefrontUrl;
  }
  if (runtimePublicStorefrontUrl) {
    process.env.PUBLIC_STOREFRONT_URL = runtimePublicStorefrontUrl;
  }
  if (invalidationBefore?.trim() && !process.env[invalidationKey]?.trim()) {
    process.env[invalidationKey] = invalidationBefore;
  }
}

module.exports = { loadMonorepoRootEnv };
