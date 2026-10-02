#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { sourcePathToApiPath, validateApiRouteHeaders } from "./check-deployed-api-route-headers.mjs";

const DEFAULT_BASE_URL = "https://universalmusic.vercel.app";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(scriptDirectory, "..", "apps/web/src/app/api");
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

export function loadApiMethodContract(root = apiRoot) {
  return walk(root)
    .filter((sourcePath) => sourcePath.endsWith("/route.ts"))
    .flatMap((sourcePath) => {
      const source = readFileSync(sourcePath, "utf8");
      const declared = methods.filter((method) =>
        new RegExp(
          `export\\s+(?:(?:async\\s+)?function\\s+${method}\\b|const\\s+${method}\\b|\\{[^}]*\\b${method}\\b)`,
        ).test(source),
      );
      const routeMethods = [...new Set(declared)].sort();
      const path = sourcePathToApiPath(sourcePath, root);
      return routeMethods.map((method) => ({
        path,
        method,
        sourcePath: relative(join(root, "../.."), sourcePath),
        cache: path === "/api/feature-mappings" || path === "/api/shop/search-suggest" ? "public" : "private",
      }));
    })
    .sort((left, right) => `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`));
}

function header(response, name) {
  return response.headers?.get?.(name) ?? response.headers?.[name] ?? "";
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function validateApiMethodResponse({ response, contract, url }) {
  const failures = validateApiRouteHeaders({ headers: response.headers }, contract, `${url} ${contract.method}`);
  if (response.status >= 500) failures.push(`${url} ${contract.method} returned HTTP ${response.status}`);
  const contentType = header(response, "content-type").toLowerCase();
  const isEmptyRedirect = response.status >= 300 && response.status < 400 && Boolean(header(response, "location"));
  const isJsonMediaType = contentType.includes("application/json") || contentType.includes("+json");
  if (contract.method !== "HEAD" && response.status !== 204 && !isEmptyRedirect && !isJsonMediaType) {
    failures.push(`${url} ${contract.method} returned non-JSON content-type: ${contentType || "<missing>"}`);
  }
  return failures;
}

export async function runChecks({
  baseUrl = process.env.STOREFRONT_URL_PRODUCTION ?? DEFAULT_BASE_URL,
  contracts = loadApiMethodContract(),
  fetchImpl = fetch,
} = {}) {
  const failures = [];
  const base = normalizeBaseUrl(baseUrl);
  const queue = [...contracts];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const contract = queue.shift();
      if (!contract) return;
      const query = contract.path === "/api/admin/cms/components/__contract__" ? "?version=1" : "";
      const url = `${base}${contract.path}${query}`;
      const init = {
        method: contract.method,
        redirect: "manual",
        headers: {
          Accept: "application/json",
          ...(contract.method !== "GET"
            ? { "Content-Type": "application/json", "Idempotency-Key": `codex-contract-${contract.method.toLowerCase()}` }
            : {}),
        },
        ...(contract.method !== "GET"
          ? { body: "{}" }
          : {}),
      };
      try {
        const response = await fetchImpl(url, init);
        failures.push(...validateApiMethodResponse({ response, contract, url }));
      } catch (error) {
        failures.push(`${url} ${contract.method} request failed: ${error.message}`);
      }
    }
  });
  await Promise.all(workers);
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const contracts = loadApiMethodContract();
  const failures = await runChecks({ contracts });
  if (failures.length) {
    console.error("Deployed API method contract check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Deployed API method contract passed for ${contracts.length} declared route methods.`);
  }
}
