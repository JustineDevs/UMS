import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "apps/web/src/app/api");
const output = path.join(root, "docs/route-ownership-manifest.json");

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

function apiPath(file) {
  return `/${path.relative(apiRoot, path.dirname(file)).split(path.sep).join("/").replace(/\[([^\]]+)\]/g, "{$1}")}`;
}

function methods(source) {
  return [...source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)]
    .map((match) => match[1].toLowerCase())
    .sort();
}

async function classify(route, source) {
  const signals = [];
  const workerAdminBridge = /import\s*\{[^}]*\b[A-Za-z_$][\w$]*Worker[A-Za-z_$\w]*ForAdmin\b[^}]*\}\s*from\s*["']@\/lib\/worker-admin-bridge["']/.test(source);
  const chatOrderWorkerSearch = /import\s*\{\s*searchCatalogVariantLines\s*\}\s*from\s*["']@\/lib\/chat-order-catalog-search["']/.test(source) &&
    /fetchWorkerCatalogProductsForAdmin/.test(await fs.readFile(path.join(root, "apps/web/src/lib/chat-order-catalog-search.ts"), "utf8"));
  const workerProxy = workerAdminBridge || chatOrderWorkerSearch ||
    /proxyWorker(?:Admin|Public|Storefront)Route|(?:fetchWorker|saveWorker|deleteWorker|bulkDeleteWorker|publishWorker)[A-Z]/.test(source) ||
    (/process\.env\.API_URL/.test(source) && /\bfetch\s*\(/.test(source));
  // `createSupabaseServerClient` is also used by Worker proxies only to read
  // the caller's session token. Treat it as direct database access only when
  // the route actually selects/mutates a table or uses an admin DB boundary.
  const directDatabase = /adminSupabaseOr503|tryCreateSupabaseClient|\.from\(["'`]/.test(source);
  const serviceBoundary = route.startsWith("/internal/") || route.startsWith("/cron/") || route.includes("/webhooks/");
  if (workerProxy) signals.push("worker-proxy");
  if (directDatabase) signals.push("direct-database");
  if (serviceBoundary) signals.push("service-or-callback-boundary");

  let owner = "web-runtime";
  if (workerProxy && directDatabase) owner = "web-bff-worker-origin";
  else if (workerProxy) owner = "worker-origin";
  else if (serviceBoundary) owner = "web-service-boundary";
  else if (directDatabase) owner = "web-platform-database";

  return { owner, signals };
}

const entries = [];
for (const file of (await routeFiles(apiRoot)).sort()) {
  const source = await fs.readFile(file, "utf8");
  const route = apiPath(file);
  const classification = await classify(route, source);
  entries.push({
    route,
    methods: methods(source),
    source: path.relative(root, file).split(path.sep).join("/"),
    ...classification,
  });
}

const manifest = {
  version: 1,
  generatedFrom: "apps/web/src/app/api",
  topology: {
    frontend: "Vercel Next.js",
    commerceBackend: "Cloudflare Worker",
    databases: ["APP_DB_URL", "MEDUSA_DB_URL"],
  },
  entries,
};
await fs.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${path.relative(root, output)} for ${entries.length} route files.`);
