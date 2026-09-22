import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const appRoot = path.join(root, "apps/web/src/app");
const manifest = JSON.parse(await fs.readFile(path.join(root, "docs/route-state-manifest.json"), "utf8"));
const files = [];
async function walk(dir) { for (const entry of await fs.readdir(dir, { withFileTypes: true })) { const absolute = path.join(dir, entry.name); if (entry.isDirectory()) await walk(absolute); else if (entry.name === "page.tsx") files.push(absolute); } }
await walk(appRoot);
const routeFor = (file) => `/${path.relative(appRoot, path.dirname(file)).split(path.sep).join("/").replace(/\([^)]*\)\//g, "").replace(/\[\[?\.\.\.[^\]]+\]?\]/g, "{catchAll}").replace(/\[([^\]]+)\]/g, "{$1}").replace(/\/+/g, "/")}`.replace(/\/$/, "") || "/";
const current = new Set(files.map(routeFor));
const listed = new Set((manifest.entries ?? []).map((entry) => entry.route));
const missing = [...current].filter((route) => !listed.has(route));
const stale = [...listed].filter((route) => !current.has(route));
if (missing.length || stale.length) { if (missing.length) console.error(`[route-state] missing: ${missing.join(", ")}`); if (stale.length) console.error(`[route-state] stale: ${stale.join(", ")}`); process.exit(1); }
const requiredSignals = ["loading", "empty", "blocked", "unauthorized", "failure", "retry", "success"];
const incomplete = (manifest.entries ?? []).filter((entry) =>
  entry.verification !== "static-inventory" ||
  requiredSignals.some((signal) => typeof entry.signals?.[signal] !== "boolean"),
);
if (incomplete.length) {
  console.error(`[route-state] entries missing truthful state inventory: ${incomplete.map((entry) => entry.route).join(", ")}`);
  process.exit(1);
}
const loading = (manifest.entries ?? []).filter((entry) => entry.loadingBoundary).length;
const errors = (manifest.entries ?? []).filter((entry) => entry.errorBoundary).length;
const stateCounts = Object.fromEntries(requiredSignals.map((signal) => [signal, (manifest.entries ?? []).filter((entry) => entry.signals[signal]).length]));
console.log(`[route-state] ${current.size} page routes inventoried; ${loading} have loading boundaries, ${errors} have error boundaries; static state signals ${JSON.stringify(stateCounts)}; runtime browser verification remains separate`);
