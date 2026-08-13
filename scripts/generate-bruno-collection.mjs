#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, "bruno", "universal-music-store-api");
const collectionName = "Universal Music Store API";

const routeRoots = [
  {
    app: "storefront",
    sourceRoot: path.join(repoRoot, "apps", "storefront", "src", "app", "api"),
    urlPrefix: "/api",
    baseUrlVar: "{{storefrontBaseUrl}}",
  },
  {
    app: "admin",
    sourceRoot: path.join(repoRoot, "apps", "admin", "src", "app", "api"),
    urlPrefix: "/api",
    baseUrlVar: "{{adminBaseUrl}}",
  },
  {
    app: "medusa",
    sourceRoot: path.join(repoRoot, "apps", "medusa", "src", "api"),
    urlPrefix: "",
    baseUrlVar: "{{medusaBaseUrl}}",
  },
];

const expressRoutes = [
  { app: "platform-api", method: "GET", path: "/", source: "apps/api/src/index.ts" },
  { app: "platform-api", method: "GET", path: "/healthz", source: "apps/api/src/index.ts" },
  { app: "platform-api", method: "GET", path: "/readyz", source: "apps/api/src/index.ts" },
  { app: "platform-api", method: "GET", path: "/health", source: "apps/api/src/routes/health.ts" },
  { app: "platform-api", method: "GET", path: "/health/commerce", source: "apps/api/src/routes/health.ts" },
  { app: "platform-api", method: "GET", path: "/health/ready", source: "apps/api/src/routes/health.ts" },
  { app: "platform-api", method: "GET", path: "/compliance/export", source: "apps/api/src/routes/compliance.ts" },
  { app: "platform-api", method: "POST", path: "/compliance/erasure", source: "apps/api/src/routes/compliance.ts" },
  {
    app: "platform-api",
    method: "POST",
    path: "/compliance/retention/anonymize-addresses",
    source: "apps/api/src/routes/compliance.ts",
  },
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

main();

function main() {
  const routes = [
    ...collectFileBasedRoutes(),
    ...collectExpressRoutes(),
  ].sort((a, b) => {
    const left = `${a.app}/${a.path}/${a.method}`;
    const right = `${b.app}/${b.path}/${b.method}`;
    return left.localeCompare(right);
  });

  if (!checkOnly) {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });
  }

  writeFile(
    path.join(outputDir, "bruno.json"),
    JSON.stringify(
      {
        version: "1",
        name: collectionName,
        type: "collection",
        ignore: ["node_modules", ".git", ".next", "dist", "build"],
      },
      null,
      2,
    ) + "\n",
  );

  writeFile(path.join(outputDir, "environments", "Development.bru"), renderEnvironment("Development", {
    storefrontBaseUrl: "http://localhost:3000",
    adminBaseUrl: "http://localhost:3001",
    medusaBaseUrl: "http://localhost:9000",
    apiBaseUrl: "http://localhost:4000",
  }));

  writeFile(path.join(outputDir, "environments", "Staging.bru"), renderEnvironment("Staging", {
    storefrontBaseUrl: "https://staging-storefront.example.com",
    adminBaseUrl: "https://staging-admin.example.com",
    medusaBaseUrl: "https://staging-medusa.example.com",
    apiBaseUrl: "https://staging-api.example.com",
  }));

  writeFile(path.join(outputDir, "environments", "Production.bru"), renderEnvironment("Production", {
    storefrontBaseUrl: "https://storefront.example.com",
    adminBaseUrl: "https://admin.example.com",
    medusaBaseUrl: "https://medusa.example.com",
    apiBaseUrl: "https://api.example.com",
  }));

  let seq = 1;
  for (const route of routes) {
    const requestRoot = path.join(outputDir, route.app);
    const pathSegments = splitPathSegments(route);
    const folderSegments = pathSegments.slice(0, -1);
    const requestName = buildRequestName(route.method, pathSegments);
    const fileName = buildFileName(route.method, pathSegments);
    const requestDir = folderSegments.length
      ? path.join(requestRoot, ...folderSegments)
      : requestRoot;
    const requestPath = buildRequestUrl(route.baseUrlVar ?? route.baseUrl ?? "{{baseUrl}}", route.path);
    const headers = inferHeaders(route);
    const request = renderRequest({
      seq: seq++,
      name: requestName,
      method: route.method,
      url: requestPath,
      headers,
      source: route.source,
      bodyHint: inferBodyHint(route),
    });

    ensureFolderChain(requestRoot, folderSegments);
    writeFile(path.join(requestDir, `${fileName}.bru`), request);
  }

  console.log(
    `Generated Bruno collection at ${path.relative(repoRoot, outputDir)} with ${routes.length} requests.`,
  );
}

function collectFileBasedRoutes() {
  const routes = [];

  for (const root of routeRoots) {
    if (!fs.existsSync(root.sourceRoot)) {
      continue;
    }

    for (const file of walkFiles(root.sourceRoot)) {
      if (!file.endsWith(`${path.sep}route.ts`)) {
        continue;
      }

      const source = fs.readFileSync(file, "utf8");
      const methods = extractRouteMethods(source);
      if (methods.length === 0) {
        continue;
      }

      const routePath = deriveRoutePath(root, file);
      for (const method of methods) {
        routes.push({
          app: root.app,
          method,
          path: routePath,
          source: path.relative(repoRoot, file),
          baseUrlVar: root.baseUrlVar,
        });
      }
    }
  }

  return routes;
}

function collectExpressRoutes() {
  return expressRoutes.map((route) => ({
    ...route,
    baseUrlVar: "{{apiBaseUrl}}",
  }));
}

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function extractRouteMethods(source) {
  const methods = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)) {
    methods.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)) {
    methods.add(match[1]);
  }
  return [...methods];
}

function deriveRoutePath(root, file) {
  const relativeDir = path.relative(root.sourceRoot, path.dirname(file));
  const segments = relativeDir === "" ? [] : relativeDir.split(path.sep).filter(Boolean);
  const normalized = segments.map(normalizePathSegment).filter(Boolean);

  if (root.app === "medusa") {
    return normalized.length ? `/${normalized.join("/")}` : "/";
  }

  const prefixed = normalized.length ? `${root.urlPrefix}/${normalized.join("/")}` : root.urlPrefix;
  return prefixed || "/";
}

function normalizePathSegment(segment) {
  const optionalCatchAll = segment.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
  if (optionalCatchAll) {
    return `{{${cleanParamName(optionalCatchAll[1])}}}`;
  }

  const catchAll = segment.match(/^\[\.\.\.([^\]]+)\]$/);
  if (catchAll) {
    return `{{${cleanParamName(catchAll[1])}}}`;
  }

  const pathParam = segment.match(/^\[([^\]]+)\]$/);
  if (pathParam) {
    return `{{${cleanParamName(pathParam[1])}}}`;
  }

  return segment;
}

function cleanParamName(name) {
  return String(name)
    .replace(/\.\.\./g, "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "param";
}

function splitPathSegments(route) {
  const segments = route.path.split("/").filter(Boolean);
  if (segments[0] === "api") {
    segments.shift();
  }
  if (route.app === "admin" && segments[0] === "admin") {
    segments.shift();
  }
  return segments;
}

function buildRequestName(method, pathSegments) {
  const humanPath = pathSegments.length
    ? pathSegments.map(humanizeSegment).join(" ")
    : "Root";
  return `${capitalize(method.toLowerCase())} ${humanPath}`;
}

function buildFileName(method, pathSegments) {
  const lastSegment = pathSegments.at(-1) ?? "root";
  const slug = slugify(lastSegment);
  return `${method.toLowerCase()}-${slug}`;
}

function humanizeSegment(segment) {
  if (segment.startsWith("{{") && segment.endsWith("}}")) {
    return `By ${capitalizeWords(segment.slice(2, -2).replace(/_/g, " "))}`;
  }
  return capitalizeWords(segment.replace(/-/g, " ").replace(/_/g, " "));
}

function slugify(segment) {
  return segment
    .replace(/^\{\{|\}\}$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "root";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function capitalizeWords(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => capitalize(word.toLowerCase()))
    .join(" ");
}

function inferHeaders(route) {
  const headers = ["Accept: application/json"];
  const routePath = route.path.toLowerCase();
  const method = route.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !routePath.includes("/upload-payment-receipt") && !routePath.includes("/channels/webhook")) {
    headers.push("Content-Type: application/json");
  }

  if (route.app === "platform-api" && routePath.startsWith("/compliance")) {
    headers.push("x-internal-api-key: {{internalApiKey}}");
  }

  if (route.app === "storefront" && (routePath.startsWith("/api/internal/") || routePath.startsWith("/api/cron/"))) {
    headers.push("x-internal-api-key: {{storefrontInternalApiKey}}");
  }

  if (route.app === "storefront" && (routePath.startsWith("/api/account/") || routePath.startsWith("/api/cart/") || routePath.startsWith("/api/checkout/") || routePath.startsWith("/api/payments/") || routePath.startsWith("/api/wishlist") || routePath.startsWith("/api/reviews"))) {
    headers.push("Cookie: {{customerSessionCookie}}");
  }

  if (route.app === "admin" && routePath.startsWith("/api/admin/")) {
    headers.push("Cookie: {{adminSessionCookie}}");
  }

  if (route.app === "admin" && routePath === "/api/integrations/channels/webhook") {
    headers.push("x-channel-secret: {{channelWebhookSecret}}");
  }

  if (route.app === "admin" && (routePath.startsWith("/api/integrations/") || routePath.startsWith("/api/pos/"))) {
    headers.push("x-internal-api-key: {{adminIntegrationKey}}");
  }

  if (route.app === "medusa" && routePath.startsWith("/admin/")) {
    headers.push("x-medusa-access-token: {{medusaSecretApiKey}}");
  }

  if (route.app === "medusa" && routePath.startsWith("/store/")) {
    headers.push("x-publishable-api-key: {{medusaPublishableKey}}");
  }

  if (route.app === "medusa" && routePath.startsWith("/hooks/")) {
    headers.push("x-webhook-secret: {{medusaWebhookSecret}}");
  }

  return headers;
}

function inferBodyHint(route) {
  const routePath = route.path.toLowerCase();
  if (route.method === "GET" || route.method === "HEAD" || route.method === "OPTIONS") {
    return "";
  }

  if (routePath.includes("/back-in-stock")) {
    return "Payload hint: email, productId, optional productSlug, optional variantId.";
  }

  if (routePath.includes("/newsletter")) {
    return "Payload hint: email.";
  }

  if (routePath.includes("/forms/")) {
    return "Payload hint: form submission fields defined by the form key.";
  }

  if (routePath.includes("/compliance/erasure")) {
    return "Payload hint: email.";
  }

  if (routePath.includes("/compliance/retention/anonymize-addresses")) {
    return "Payload hint: optional days integer.";
  }

  if (routePath.includes("/invalidate-commerce-state")) {
    return "Payload hint: productHandles, collectionHandles, optional path hints.";
  }

  if (routePath.includes("/upload-payment-receipt")) {
    return "Payload hint: multipart form-data with orderId and receipt file.";
  }

  return "";
}

function renderRequest({ seq, name, method, url, headers, source, bodyHint }) {
  const lines = [];
  lines.push("meta {");
  lines.push(`  name: ${name}`);
  lines.push("  type: http");
  lines.push(`  seq: ${seq}`);
  lines.push("}");
  lines.push("");
  lines.push(`${method.toLowerCase()} {`);
  lines.push(`  url: ${url}`);
  lines.push("  body: none");
  lines.push("}");
  lines.push("");
  if (headers.length > 0) {
    lines.push("headers {");
    for (const header of headers) {
      lines.push(`  ${header}`);
    }
    lines.push("}");
    lines.push("");
  }
  lines.push("docs {");
  lines.push(`  Source: ${source}`);
  if (bodyHint) {
    lines.push(`  ${bodyHint}`);
  }
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function renderEnvironment(name, vars) {
  const lines = [];
  lines.push("vars {");
  lines.push("  @description('''Base URL for the storefront app.''')");
  lines.push(`  storefrontBaseUrl: ${vars.storefrontBaseUrl}`);
  lines.push("");
  lines.push("  @description('''Base URL for the admin app.''')");
  lines.push(`  adminBaseUrl: ${vars.adminBaseUrl}`);
  lines.push("");
  lines.push("  @description('''Base URL for the Medusa app.''')");
  lines.push(`  medusaBaseUrl: ${vars.medusaBaseUrl}`);
  lines.push("");
  lines.push("  @description('''Base URL for the shared API service.''')");
  lines.push(`  apiBaseUrl: ${vars.apiBaseUrl}`);
  lines.push("");
  lines.push("  @description('''Internal API key for protected platform endpoints.''')");
  lines.push("  internalApiKey: CHANGE_ME_INTERNAL_API_KEY");
  lines.push("");
  lines.push("  @description('''Internal API key for storefront internal-only routes.''')");
  lines.push("  storefrontInternalApiKey: CHANGE_ME_STOREFRONT_INTERNAL_API_KEY");
  lines.push("");
  lines.push("  @description('''Admin session cookie for authenticated staff requests.''')");
  lines.push("  adminSessionCookie: CHANGE_ME_ADMIN_SESSION_COOKIE");
  lines.push("");
  lines.push("  @description('''Customer session cookie for authenticated storefront requests.''')");
  lines.push("  customerSessionCookie: CHANGE_ME_CUSTOMER_SESSION_COOKIE");
  lines.push("");
  lines.push("  @description('''Webhook secret for integration callbacks.''')");
  lines.push("  channelWebhookSecret: CHANGE_ME_CHANNEL_WEBHOOK_SECRET");
  lines.push("");
  lines.push("  @description('''Integration key for protected admin integrations.''')");
  lines.push("  adminIntegrationKey: CHANGE_ME_ADMIN_INTEGRATION_KEY");
  lines.push("");
  lines.push("  @description('''Medusa secret API key for admin endpoints.''')");
  lines.push("  medusaSecretApiKey: CHANGE_ME_MEDUSA_SECRET_API_KEY");
  lines.push("");
  lines.push("  @description('''Medusa publishable API key for store endpoints.''')");
  lines.push("  medusaPublishableKey: CHANGE_ME_MEDUSA_PUBLISHABLE_API_KEY");
  lines.push("");
  lines.push("  @description('''Webhook secret for Medusa callback verification.''')");
  lines.push("  medusaWebhookSecret: CHANGE_ME_MEDUSA_WEBHOOK_SECRET");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function ensureFolderChain(root, folderSegments) {
  let current = root;
  for (const segment of folderSegments) {
    current = path.join(current, segment);
    ensureDir(current);
    writeFile(
      path.join(current, "folder.bru"),
      [
        "meta {",
        `  name: ${humanizeSegment(segment)}`,
        "}",
        "",
      ].join("\n"),
    );
  }
}

function writeFile(filePath, content) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (existing === content) {
    return;
  }
  if (checkOnly) {
    throw new Error(`Bruno collection drift detected in ${path.relative(repoRoot, filePath)}`);
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function buildRequestUrl(baseUrl, routePath) {
  if (routePath === "/") {
    return baseUrl;
  }
  return `${String(baseUrl).replace(/\/+$/, "")}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}
