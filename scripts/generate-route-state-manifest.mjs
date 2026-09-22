import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appRoot = path.join(root, "apps/web/src/app");
const output = path.join(root, "docs/route-state-manifest.json");
async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (/^(page|loading|error)\.tsx$/.test(entry.name)) files.push(absolute);
  }
  return files;
}
function routeFor(file) {
  return `/${path.relative(appRoot, path.dirname(file)).split(path.sep).join("/").replace(/\([^)]*\)\//g, "").replace(/\[\[?\.\.\.[^\]]+\]?\]/g, "{catchAll}").replace(/\[([^\]]+)\]/g, "{$1}").replace(/\/+/g, "/")}`.replace(/\/$/, "") || "/";
}
const files = await walk(appRoot);
const pages = files.filter((file) => path.basename(file) === "page.tsx");
const entries = [];
for (const file of pages.sort()) {
  let cursor = path.dirname(file);
  let loadingBoundary = null;
  let errorBoundary = null;
  while (cursor.startsWith(appRoot)) {
    if (!loadingBoundary && files.includes(path.join(cursor, "loading.tsx"))) loadingBoundary = path.relative(root, path.join(cursor, "loading.tsx")).split(path.sep).join("/");
    if (!errorBoundary && files.includes(path.join(cursor, "error.tsx"))) errorBoundary = path.relative(root, path.join(cursor, "error.tsx")).split(path.sep).join("/");
    cursor = path.dirname(cursor);
  }
  const source = await fs.readFile(file, "utf8");
  const stateSource = source.toLowerCase();
  entries.push({
    route: routeFor(file),
    source: path.relative(root, file).split(path.sep).join("/"),
    client: /^\s*["']use client["']/.test(source),
    loadingBoundary,
    errorBoundary,
    verification: "static-inventory",
    signals: {
      fetch: /\bfetch\s*\(/.test(source),
      form: /<form\b/.test(source),
      loading: Boolean(loadingBoundary) || /loading|isloading|pending|skeleton/.test(stateSource),
      empty: /empty|no results|nothing here|not found/.test(stateSource),
      blocked: /blocked|disabled|unavailable|not configured|not supported/.test(stateSource),
      unauthorized: /unauthorized|forbidden|permission|sign in|log in/.test(stateSource),
      failure: Boolean(errorBoundary) || /error|failed|failure|problem/.test(stateSource),
      retry: /retry|try again|reload/.test(stateSource),
      success: /success|completed|ready|loaded|saved|published/.test(stateSource),
    },
  });
}
await fs.writeFile(output, `${JSON.stringify({ version: 1, generatedFrom: "apps/web/src/app", entries }, null, 2)}\n`, "utf8");
console.log(`Generated ${path.relative(root, output)} for ${entries.length} pages.`);
