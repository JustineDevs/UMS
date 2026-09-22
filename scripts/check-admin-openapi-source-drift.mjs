import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "apps/web/src/app/api");
const specPath = path.join(root, "internal/reference/admin-open-api.yaml");

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

const [spec, files] = await Promise.all([
  fs.readFile(specPath, "utf8"),
  routeFiles(apiRoot),
]);
const currentHashes = new Set();
for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  currentHashes.add(crypto.createHash("sha256").update(source).digest("hex"));
}
const specHashes = [...spec.matchAll(/^\s+x-source-sha256:\s*([a-f0-9]{64})\s*$/gm)].map((match) => match[1]);
const stale = [...new Set(specHashes.filter((hash) => !currentHashes.has(hash)))];
if (stale.length > 0) {
  console.error(`[admin-openapi-source] ${stale.length} stale source hashes found in ${path.relative(root, specPath)}`);
  for (const hash of stale) console.error(`- ${hash}`);
  process.exit(1);
}
if (specHashes.length === 0) {
  console.error("[admin-openapi-source] no source hashes found; regenerate the OpenAPI reference");
  process.exit(1);
}
console.log(`[admin-openapi-source] ${specHashes.length} operation hashes match the current route tree`);
