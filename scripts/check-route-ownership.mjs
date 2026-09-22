import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "apps/web/src/app/api");
const manifestPath = path.join(root, "docs/route-ownership-manifest.json");
const allowedOwners = new Set([
  "web-runtime",
  "web-platform-database",
  "web-service-boundary",
  "worker-origin",
  "web-bff-worker-origin",
]);

async function routeFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await routeFiles(absolute)));
    else if (entry.name === "route.ts") files.push(absolute);
  }
  return files;
}

function routeFor(file) {
  return `/${path.relative(apiRoot, path.dirname(file)).split(path.sep).join("/").replace(/\[([^\]]+)\]/g, "{$1}")}`;
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
  throw new Error("Route ownership manifest is invalid");
}
const files = await routeFiles(apiRoot);
const current = new Map();
for (const file of files) current.set(routeFor(file), path.relative(root, file));
const listed = new Map(manifest.entries.map((entry) => [entry.route, entry]));
const missing = [...current.keys()].filter((route) => !listed.has(route));
const stale = [...listed.keys()].filter((route) => !current.has(route));
const invalid = manifest.entries.filter((entry) => !allowedOwners.has(entry.owner));
const unsafeWorkerProxies = [];
for (const entry of manifest.entries) {
  if (entry.owner !== "worker-origin") continue;
  const source = await fs.readFile(path.join(root, entry.source), "utf8");
  if (/adminSupabaseOr503|tryCreateSupabaseClient|\.from\(["'`]/.test(source)) {
    unsafeWorkerProxies.push(entry.route);
  }
}
if (missing.length || stale.length || invalid.length || unsafeWorkerProxies.length) {
  if (missing.length) console.error(`Missing ownership entries: ${missing.join(", ")}`);
  if (stale.length) console.error(`Stale ownership entries: ${stale.join(", ")}`);
  if (invalid.length) console.error(`Invalid owners: ${invalid.map((entry) => `${entry.route}=${entry.owner}`).join(", ")}`);
  if (unsafeWorkerProxies.length) console.error(`Worker-origin routes import direct database access: ${unsafeWorkerProxies.join(", ")}`);
  process.exit(1);
}
console.log(`[route-ownership] ${current.size} route files have explicit ownership; no unsafe Worker-origin database imports`);
