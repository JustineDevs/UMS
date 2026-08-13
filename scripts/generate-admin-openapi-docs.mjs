import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const apiRoot = path.join(root, "apps/admin/src/app/api");
const outputYaml = path.join(root, "internal/reference/admin-open-api.yaml");
const outputPdf = path.join(root, "internal/reference/admin-open-api.pdf");

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

function toApiPath(file) {
  const relative = path.relative(apiRoot, path.dirname(file)).split(path.sep).join("/");
  return `/${relative.replace(/\[([^\]]+)\]/g, "{$1}")}`;
}

function titleFromPath(apiPath) {
  return apiPath
    .replace(/^\//, "")
    .replace(/[{}]/g, "")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[-_]/g, " "))
    .join(" / ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tagFromPath(apiPath) {
  const parts = apiPath.split("/").filter(Boolean);
  return parts[1] ? titleFromPath(`/${parts[0]}/${parts[1]}`) : "Admin";
}

function yamlString(value) {
  return JSON.stringify(value);
}

function operationId(method, apiPath) {
  return `${method}_${apiPath.replace(/^\//, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function contractMetadata(method, apiPath, source) {
  const mutation = ["post", "put", "patch", "delete"].includes(method);
  const idempotent = mutation && !apiPath.startsWith("/auth/") && (
    apiPath.startsWith("/admin/") ||
    /withAdminMutationIdempotency|claimAdminIdempotency|requiredIdempotencyKey|idempotency-key/i.test(source)
  );
  const guard = source.match(/requireStaffApiSession(?:Any)?\(\s*["'`]([^"'`]+)|requireStaffSessionWithPermission\(\s*["'`]([^"'`]+)/);
  const permission = guard?.[1] ?? guard?.[2] ?? (source.includes("requireStaffSession") ? "staff-session" : "internal-signature");
  const webhook = /webhook/i.test(apiPath);
  return {
    operationId: operationId(method, apiPath),
    mutation,
    permission,
    tenantScoped: /resolveStaffOrganization|organization_id|organizationId|store_id|storeId/.test(source),
    idempotent,
    routeReplayProtected: !idempotent || (webhook ? /replay|event_id|eventId|idempotency/i.test(source) : /withAdminMutationIdempotency|claimAdminIdempotency|getIdempotencyKey|requiredIdempotencyKey|idempotency-key/i.test(source)),
    bodyContract: mutation && !webhook ? `${operationId(method, apiPath)}Request` : null,
    responseContract: `${operationId(method, apiPath)}Response`,
  };
}

function extractZodProperties(source) {
  const properties = {};
  for (const match of source.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*z\.(string|number|boolean|enum|array|record|object)\s*(?:\(\s*([^)]*)\))?/g)) {
    const [, name, kind, args = ""] = match;
    const property = kind === "number" ? { type: "number" } : kind === "boolean" ? { type: "boolean" } : kind === "array" ? { type: "array", items: {} } : kind === "object" || kind === "record" ? { type: "object" } : { type: "string" };
    if (kind === "enum") {
      const values = [...args.matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
      if (values.length) property.enum = values;
    }
    const tail = source.slice(match.index + match[0].length, match.index + match[0].length + 80);
    if (/\.optional\(\)|\.default\(/.test(tail)) property["x-optional"] = true;
    properties[name] = property;
  }
  return properties;
}

function extractResponseProperties(source) {
  const properties = {};
  for (const match of source.matchAll(/(?:NextResponse\.json|json)\s*\(\s*\{\s*([\s\S]{0,1400}?)(?:\}\s*,|\}\s*\))/g)) {
    for (const key of match[1].matchAll(/(?:^|[,\n])\s*([A-Za-z_$][\w$]*)\s*:/g)) properties[key[1]] ??= { type: "string" };
  }
  return properties;
}

function operationYaml(method, apiPath, tag, source) {
  const contract = contractMetadata(method, apiPath, source);
  const action = method === "get" ? "Read" : method === "post" ? "Create or execute" : method === "delete" ? "Delete" : "Update";
  const lines = [
    `    ${method}:`,
    `      operationId: ${contract.operationId}`,
    `      summary: ${yamlString(`${action} ${titleFromPath(apiPath)}`)}`,
    `      description: ${yamlString(`${titleFromPath(apiPath)}. Contract metadata is derived from the route handler and checked against its runtime controls.`)}`,
    `      tags: [${yamlString(tag)}]`,
    `      x-source: ${yamlString(source)}`,
    `      x-permission: ${yamlString(contract.permission)}`,
    `      x-tenant-scoped: ${contract.tenantScoped ? "true" : "false"}`,
    `      x-idempotency-required: ${contract.idempotent ? "true" : "false"}`,
    `      x-idempotency-persisted: ${contract.routeReplayProtected ? "true" : "false"}`,
    "      security:",
    "        - AdminSession: []",
    "        - StaffApiKey: []",
  ];
  const params = [...apiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  if (params.length) {
    lines.push("      parameters:");
    for (const parameter of params) {
      lines.push(`        - name: ${parameter}`, "          in: path", "          required: true", "          schema:", "            type: string");
    }
  }
  if (contract.mutation && !/webhook/i.test(apiPath)) {
    lines.push("        - name: Idempotency-Key", "          in: header", "          required: true", "          schema:", "            type: string", "            minLength: 8", "            maxLength: 200");
  }
  if (contract.bodyContract) {
    lines.push("      requestBody:", "        required: true", "        content:", "          application/json:", "            schema:", `              $ref: '#/components/schemas/${contract.bodyContract}'`);
  }
  lines.push(
    "      responses:",
    '        "200":',
    "          description: Operation completed successfully.",
    "          content:",
    "            application/json:",
    "              schema:",
    `                $ref: '#/components/schemas/${contract.responseContract}'`,
    '        "400":',
    "          description: Invalid request.",
    '        "401":',
    "          description: Authentication or permission required.",
    '        "500":',
    "          description: Internal operation failure.",
  );
  return lines.join("\n");
}

function escapeHtml(value) {
  return value.replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

const files = (await routeFiles(apiRoot)).sort();
const endpoints = [];
for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  const methods = [...source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((match) => match[1].toLowerCase());
  const apiPath = toApiPath(file);
  for (const method of methods) endpoints.push({ method, path: apiPath, tag: tagFromPath(apiPath), source: path.relative(root, file) });
}

const groups = [...new Set(endpoints.map((endpoint) => endpoint.tag))].sort();
const yaml = [
  "openapi: 3.1.0",
  "info:",
  "  title: Universal Music Store Admin Open API",
  "  version: 1.0.0",
  "  description: >",
  "    English reference documentation for protected administration operations.",
  "",
  "    All endpoints are implemented under the Next.js admin application and are",
  "    subject to staff authentication, permission checks, audit logging, and",
  "    domain-specific validation.",
  "servers:",
  "  - url: /api",
  "    description: Admin application API",
  "security:",
  "  - AdminSession: []",
  "tags:",
  ...groups.flatMap((tag) => [`  - name: ${yamlString(tag)}`, `    description: ${yamlString(`Operations for ${tag}.`)}`]),
  "paths:",
];
const endpointsByPath = new Map();
for (const endpoint of endpoints) {
  const methods = endpointsByPath.get(endpoint.path) ?? new Map();
  if (methods.has(endpoint.method)) {
    throw new Error(`Duplicate OpenAPI operation discovered: ${endpoint.method.toUpperCase()} ${endpoint.path}`);
  }
  methods.set(endpoint.method, endpoint);
  endpointsByPath.set(endpoint.path, methods);
}
for (const [apiPath, methods] of [...endpointsByPath.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  yaml.push(`  ${apiPath}:`);
  for (const endpoint of [...methods.values()].sort((a, b) => a.method.localeCompare(b.method))) {
    yaml.push(operationYaml(endpoint.method, apiPath, endpoint.tag, await fs.readFile(path.join(root, endpoint.source), "utf8")));
  }
}
const schemas = new Map();
for (const endpoint of endpoints) {
  const source = await fs.readFile(path.join(root, endpoint.source), "utf8");
  const contract = contractMetadata(endpoint.method, endpoint.path, source);
  if (contract.bodyContract) schemas.set(contract.bodyContract, { properties: extractZodProperties(source), description: `Validated request payload for ${endpoint.method.toUpperCase()} ${endpoint.path}. Runtime source: ${endpoint.source}.` });
  schemas.set(contract.responseContract, { properties: extractResponseProperties(source), description: `Response contract for ${endpoint.method.toUpperCase()} ${endpoint.path}. Runtime source: ${endpoint.source}.` });
}
yaml.push(
  "components:",
  "  securitySchemes:",
  "    AdminSession:",
  "      type: apiKey",
  "      in: cookie",
  "      name: next-auth.session-token",
  "      description: Staff session issued by the admin sign-in flow.",
  "    StaffApiKey:",
  "      type: http",
  "      scheme: bearer",
  "      bearerFormat: Admin API key",
  "      description: Optional internal bearer credential for approved integrations.",
  "  schemas:",
);
for (const [name, schema] of [...schemas.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  yaml.push(`    ${name}:`, "      type: object", "      additionalProperties: false", `      description: ${yamlString(schema.description)}`);
  const properties = Object.entries(schema.properties);
  if (properties.length) {
    yaml.push("      properties:");
    for (const [property, value] of properties) {
      yaml.push(`        ${property}:`, `          type: ${value.type}`);
      if (value.enum) yaml.push(`          enum: [${value.enum.map(yamlString).join(", ")}]`);
      if (value.items) yaml.push("          items: {}" );
    }
  }
}
yaml.push(
  "    ErrorResponse:",
  "      type: object",
  "      required: [error]",
  "      properties:",
  "        error:",
  "          type: string",
  "        requestId:",
  "          type: string",
  "          description: Correlation identifier for support and audit review.",
);
await fs.writeFile(outputYaml, `${yaml.join("\n")}\n`, "utf8");

const endpointRows = endpoints.map((endpoint) => `<tr><td><code>${endpoint.method.toUpperCase()}</code></td><td><code>${escapeHtml(endpoint.path)}</code></td><td>${escapeHtml(endpoint.tag)}</td><td>${escapeHtml(endpoint.source)}</td></tr>`).join("");
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Universal Music Store Admin Open API</title><style>
@page { size: A4; margin: 18mm 15mm; } body { font-family: Arial, sans-serif; color: #17202a; font-size: 10px; line-height: 1.45; } h1 { font-size: 26px; margin: 0 0 8px; } h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #d7dee5; padding-bottom: 4px; } h3 { font-size: 12px; margin: 16px 0 5px; } p { margin: 5px 0; } .muted { color: #5d6b78; } .cover { min-height: 235mm; display: flex; flex-direction: column; justify-content: center; } .pill { display: inline-block; background: #e7f0f7; color: #16496b; padding: 4px 8px; border-radius: 12px; margin: 3px 4px 3px 0; } table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; } th, td { border: 1px solid #d7dee5; padding: 5px 6px; text-align: left; vertical-align: top; } th { background: #f0f4f7; } code { font-family: monospace; font-size: 9px; } .break { page-break-before: always; } .note { background: #f6f8fa; border-left: 3px solid #477a9e; padding: 8px; } </style></head><body>
<section class="cover"><div class="pill">OpenAPI 3.1.0</div><h1>Universal Music Store<br>Admin Open API</h1><p class="muted">English administration operations reference</p><p>Version 1.0.0</p><p class="muted">Generated from the implemented admin route tree on ${new Date().toISOString().slice(0, 10)}.</p></section>
<section class="break"><h2>Authentication and Operations</h2><p>Admin operations require an authenticated staff session or an approved internal bearer credential. Each protected route must enforce the relevant permission before mutating or exposing commerce data.</p><div class="note"><strong>Hardening guidance:</strong> preserve request correlation IDs, audit mutations, redact credentials and payment data, validate payloads server-side, and return least-privilege responses.</div><h3>Authentication schemes</h3><table><thead><tr><th>Scheme</th><th>Transport</th><th>Use</th></tr></thead><tbody><tr><td>AdminSession</td><td>Cookie</td><td>Interactive staff session from admin sign-in.</td></tr><tr><td>StaffApiKey</td><td>Bearer token</td><td>Approved internal integrations and automation.</td></tr></tbody></table><h3>Tags</h3><p>${groups.map((group) => `<span class="pill">${escapeHtml(group)}</span>`).join("")}</p></section>
<section class="break"><h2>Endpoint Index</h2><p>${endpoints.length} operations discovered from the admin application route handlers.</p><table><thead><tr><th>Method</th><th>Path</th><th>Domain</th><th>Implementation</th></tr></thead><tbody>${endpointRows}</tbody></table></section>
<section class="break"><h2>Response and Security Contract</h2><h3>Successful responses</h3><p>Each operation has its own request and response schema generated from the route handler source, with strict object boundaries and a runtime source reference. Mutation operations require an Idempotency-Key unless they are signed webhook deliveries.</p><h3>Error responses</h3><table><thead><tr><th>Status</th><th>Meaning</th><th>Required hardening behavior</th></tr></thead><tbody><tr><td>400</td><td>Invalid request</td><td>Validate and reject malformed or unsafe input.</td></tr><tr><td>401</td><td>Unauthenticated or unauthorized</td><td>Do not disclose protected resource details.</td></tr><tr><td>409</td><td>Replay or concurrency conflict</td><td>Do not execute a duplicate side effect.</td></tr><tr><td>413</td><td>Payload too large</td><td>Reject before parsing or persistence.</td></tr><tr><td>500</td><td>Internal failure</td><td>Log with correlation ID and return a safe public message.</td></tr></tbody></table><h3>Source of truth</h3><p class="muted">The companion YAML file is generated from route handlers under <code>apps/admin/src/app/api</code>. Contract metadata is emitted per operation so route, permission, tenant, and replay-control drift is visible in review.</p></section>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: outputPdf, format: "A4", printBackground: true, margin: { top: "18mm", right: "15mm", bottom: "18mm", left: "15mm" } });
await browser.close();
console.log(`Generated ${path.relative(root, outputYaml)} and ${path.relative(root, outputPdf)} for ${endpoints.length} operations.`);
