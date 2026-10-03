#!/usr/bin/env node

import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://universalmusic.vercel.app";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(scriptDirectory, "..", "apps/web/src/app/api");
const PUBLIC_CACHE_ROUTES = new Set([
  "/api/feature-mappings",
  "/api/shop/search-suggest",
]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

export function sourcePathToApiPath(sourcePath, root = apiRoot) {
  const segments = relative(root, sourcePath).split("/");
  segments.pop();
  const normalized = segments
    .filter((segment) => !/^\([^)]*\)$/.test(segment))
    .map((segment) => segment.replace(/^\[\.\.\.(.+)\]$/, "__contract__").replace(/^\[(.+)\]$/, "__contract__"));
  return `/api/${normalized.join("/")}`.replace(/\/$/, "") || "/api";
}

export function loadApiRouteContract(root = apiRoot) {
  return walk(root)
    .filter((path) => path.endsWith("/route.ts"))
    .map((sourcePath) => {
      const path = sourcePathToApiPath(sourcePath, root);
      return {
        path,
        sourcePath: relative(join(root, "../.."), sourcePath),
        cache: PUBLIC_CACHE_ROUTES.has(path) ? "public" : "private",
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function header(response, name) {
  return response.headers?.get?.(name) ?? response.headers?.[name] ?? "";
}

export function validateApiRouteHeaders({ headers }, contract, url) {
  const failures = [];
  const cacheControl = header({ headers }, "cache-control").toLowerCase();
  if (contract.cache === "private" && !cacheControl.includes("no-store")) {
    failures.push(`${url} is missing cache-control: no-store`);
  }
  if (contract.cache === "public" && !cacheControl.includes("public")) {
    failures.push(`${url} is missing an explicit public cache policy`);
  }
  if (header({ headers }, "x-content-type-options").toLowerCase() !== "nosniff") {
    failures.push(`${url} is missing x-content-type-options: nosniff`);
  }
  if (!/^max-age=\d+/.test(header({ headers }, "strict-transport-security").toLowerCase())) {
    failures.push(`${url} is missing strict-transport-security`);
  }
  if (!header({ headers }, "content-security-policy").toLowerCase().includes("frame-ancestors 'self'")) {
    failures.push(`${url} is missing a self-only content-security-policy frame-ancestors directive`);
  }
  if (!header({ headers }, "permissions-policy").trim()) {
    failures.push(`${url} is missing permissions-policy`);
  }
  const referrerPolicy = header({ headers }, "referrer-policy").toLowerCase();
  if (!referrerPolicy || !["no-referrer", "strict-origin-when-cross-origin"].includes(referrerPolicy)) {
    failures.push(`${url} is missing an approved referrer-policy`);
  }
  return failures;
}

export async function runChecks({
  baseUrl = process.env.STOREFRONT_URL_PRODUCTION ?? DEFAULT_BASE_URL,
  contracts = loadApiRouteContract(),
  fetchImpl = fetch,
} = {}) {
  const failures = [];
  const base = normalizeBaseUrl(baseUrl);
  for (const contract of contracts) {
    const url = `${base}${contract.path}`;
    try {
      const response = await fetchImpl(url, { method: "GET", redirect: "manual" });
      failures.push(...validateApiRouteHeaders({ headers: response.headers }, contract, url));
    } catch (error) {
      failures.push(`${url} request failed: ${error.message}`);
    }
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const contracts = loadApiRouteContract();
  const failures = await runChecks({ contracts });
  if (failures.length > 0) {
    console.error("Deployed API route header check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Deployed API route header check passed for ${contracts.length} source routes.`);
  }
}
