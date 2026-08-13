#!/usr/bin/env node
/**
 * Verifies that the checked-in admin OpenAPI YAML has exactly one operation for
 * every implemented App Router admin API method.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "apps", "admin", "src", "app", "api");
const documentPath = path.join(root, "internal", "reference", "admin-open-api.yaml");
const documentSource = fs.readFileSync(documentPath, "utf8");

function walkRoutes(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRoutes(absolute, out);
    else if (entry.name === "route.ts") out.push(absolute);
  }
  return out;
}

function toApiPath(file) {
  const relative = path.relative(apiRoot, path.dirname(file)).split(path.sep).join("/");
  return "/" + relative.replace(/\[([^\]]+)\]/g, "{$1}");
}

function routeOperations() {
  const result = new Set();
  for (const file of walkRoutes(apiRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const route = toApiPath(file);
    const mutations = [...source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(POST|PUT|PATCH|DELETE)\b/g)].map((match) => match[1]);
    if (mutations.length && /^\/admin\//.test(route) && !/webhook/i.test(route) && !/(withAdminMutationIdempotency|claimAdminIdempotency)/.test(source)) {
      throw new Error(`Mutation ${route} has no durable idempotency boundary.`);
    }
    for (const match of source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
      result.add(route + " " + match[1].toLowerCase());
    }
  }
  return result;
}

function documentOperations() {
if (/AdminOperation(Request|Response)/.test(documentSource) || /additionalProperties:\s*true/.test(documentSource)) {
  throw new Error("Generic admin OpenAPI request/response schemas are forbidden; every operation must have a strict contract.");
}
const result = new Set();
  const paths = new Set();
  let inPaths = false;
  let currentPath = null;
  for (const line of documentSource.split(/\r?\n/)) {
    if (line === "paths:") {
      inPaths = true;
      continue;
    }
    if (inPaths && line === "components:") break;
    if (!inPaths) continue;
    const pathMatch = /^  (\/[^:]+):$/.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1];
      if (paths.has(currentPath)) throw new Error("Duplicate OpenAPI path key: " + currentPath);
      paths.add(currentPath);
      continue;
    }
    const methodMatch = /^    (get|post|put|patch|delete):$/.exec(line);
    if (methodMatch && currentPath) result.add(currentPath + " " + methodMatch[1]);
  }
  return result;
}

const expected = routeOperations();
const actual = documentOperations();
const missing = [...expected].filter((operation) => !actual.has(operation)).sort();
const extra = [...actual].filter((operation) => !expected.has(operation)).sort();
if (missing.length || extra.length) {
  if (missing.length) console.error("[admin-openapi] Missing operations:\n" + missing.join("\n"));
  if (extra.length) console.error("[admin-openapi] Extra operations:\n" + extra.join("\n"));
  process.exit(1);
}
const operationBlocks = documentSource.split(/^    (get|post|put|patch|delete):$/m).slice(1);
for (let index = 0; index < operationBlocks.length; index += 2) {
  const block = operationBlocks[index + 1] ?? "";
  if (!/operationId:\s*\S+/.test(block) || !/x-source:/.test(block) || !/x-permission:/.test(block) || !/x-tenant-scoped:/.test(block) || !/x-idempotency-required:/.test(block) || !/x-idempotency-persisted:/.test(block)) {
    throw new Error("Every documented admin operation must declare operationId, source, permission, tenant scope, and idempotency metadata.");
  }
  if (/^      x-idempotency-required: true$/m.test(block) && !/^        - name: Idempotency-Key$/m.test(block) && !/webhook/i.test(block)) {
    throw new Error("Every non-webhook mutation must document its Idempotency-Key header.");
  }
}
console.log("[admin-openapi] " + actual.size + " route operations match the checked-in reference");
