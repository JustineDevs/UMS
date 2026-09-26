import { readFileSync } from "node:fs";

function environmentBlock(config, name, nextName) {
  const start = config.indexOf(`"${name}": {`);
  if (start < 0) return "";
  const end = nextName ? config.indexOf(`"${nextName}": {`, start + 1) : config.length;
  return config.slice(start, end < 0 ? config.length : end);
}

export function validateWorkerConfig(config) {
  const forbiddenBindings = [
    /["']containers["']\s*:/,
    /[A-Z0-9_]*_CONTAINER\b/,
    /Dockerfile\.[a-z0-9_-]+/i,
  ];
  const forbidden = forbiddenBindings.find((pattern) => pattern.test(config));
  if (forbidden) {
    return {
      ok: false,
      message: `Worker-only deployment cannot contain a container binding/runtime reference: ${forbidden}`,
    };
  }
  const envStart = config.indexOf('"env"');
  const rootConfig = envStart >= 0 ? config.slice(0, envStart) : config;
  if (/"vars"\s*:/.test(rootConfig)) {
    return {
      ok: false,
      message: "Worker vars must be declared inside dev and production; root-level shared vars are not allowed.",
    };
  }
  const environments = [
    ["dev", environmentBlock(config, "dev", "production")],
    ["production", environmentBlock(config, "production")],
  ];
  const missing = environments
    .filter(([, block]) => !/"binding"\s*:\s*"APP_HYPERDRIVE"/.test(block))
    .map(([name]) => name);

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing APP_HYPERDRIVE binding in: ${missing.join(", ")}. Provision a separate application-database Hyperdrive config before deployment; the existing MEDUSA_HYPERDRIVE cannot be reused for APP queries.`,
    };
  }

  const requiredVars = [
    "ALLOWED_ORIGINS",
    "PUBLIC_SITE_URL",
    "CMS_ORGANIZATION_ID",
    "DEFAULT_ORGANIZATION_ID",
  ];
  const missingVars = environments.flatMap(([name, block]) =>
    requiredVars
      .filter((key) => !new RegExp(`"${key}"\\s*:`).test(block))
      .map((key) => `${name}.${key}`),
  );
  if (missingVars.length > 0) {
    return {
      ok: false,
      message: `Environment-specific Worker vars must be explicit in dev and production; missing: ${missingVars.join(", ")}.`,
    };
  }

  const dev = environments[0][1];
  const production = environments[1][1];
  const devSite = /"PUBLIC_SITE_URL"\s*:\s*"https:\/\/universalmusic-preview\.vercel\.app"/.test(dev);
  const productionSite = /"PUBLIC_SITE_URL"\s*:\s*"https:\/\/universalmusic\.vercel\.app"/.test(production);
  const devOrigins = /"ALLOWED_ORIGINS"\s*:\s*"[^"]*universalmusic-preview\.vercel\.app/.test(dev);
  const productionOrigins = /"ALLOWED_ORIGINS"\s*:\s*"[^"]*universalmusic\.vercel\.app/.test(production);
  if (!devSite || !productionSite || !devOrigins || !productionOrigins) {
    return {
      ok: false,
      message: "Worker environment origins are misaligned: dev must use the preview site and production must use the stable site.",
    };
  }

  return { ok: true, message: "Worker database bindings and environment-specific vars are explicit for dev and production." };
}

export function runWorkerConfigPreflight(path = "wrangler.jsonc") {
  const outcome = validateWorkerConfig(readFileSync(path, "utf8"));
  if (!outcome.ok) {
    console.error(`[cloudflare-worker-config-preflight] ${outcome.message}`);
    return false;
  }
  console.log(`[cloudflare-worker-config-preflight] ${outcome.message}`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runWorkerConfigPreflight() ? 0 : 1;
}
