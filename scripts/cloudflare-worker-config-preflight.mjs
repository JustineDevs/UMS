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
  const missing = [
    ["dev", environmentBlock(config, "dev", "production")],
    ["production", environmentBlock(config, "production")],
  ]
    .filter(([, block]) => !/"binding"\s*:\s*"APP_HYPERDRIVE"/.test(block))
    .map(([name]) => name);

  if (missing.length === 0) {
    return { ok: true, message: "Worker database bindings are configured for dev and production." };
  }

  return {
    ok: false,
    message: `Missing APP_HYPERDRIVE binding in: ${missing.join(", ")}. Provision a separate application-database Hyperdrive config before deployment; the existing MEDUSA_HYPERDRIVE cannot be reused for APP queries.`,
  };
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
