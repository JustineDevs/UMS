import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = process.cwd();
const apiRoot = path.join(root, "apps/web/src/app/api");
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

function sourceHash(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

function operationId(method, apiPath) {
  return `${method}_${apiPath.replace(/^\//, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function authenticationMetadata(method, apiPath, source) {
  if (apiPath === "/auth/e2e") return { class: "local-e2e-credentials", schemes: [], status: "explicit" };
  if (apiPath === "/auth/callback") return { class: "oauth-callback", schemes: [], status: "source-inferred" };
  if (apiPath === "/auth/session" || apiPath === "/catalog/product-default-variant" || apiPath === "/feature-mappings" || apiPath === "/shop/product" || apiPath === "/shop/search-suggest" || apiPath === "/reviews/csrf" || apiPath === "/cart/bind-token" || apiPath === "/checkout/available-payment-methods") {
    return { class: "public", schemes: [], status: "source-inferred" };
  }
  if (["/cart/abandonment", "/checkout/commerce-telemetry", "/checkout/verify-stock"].includes(apiPath)) {
    return { class: "public-origin-protected", schemes: [], status: "source-inferred" };
  }
  if (apiPath === "/cms/preview") return { class: "signed-preview-capability", schemes: ["PreviewCapability"], status: "source-inferred" };
  if (apiPath === "/integrations/couriers/telemetry") return { class: "worker-enforced", schemes: [], status: "source-inferred" };
  if (apiPath.startsWith("/internal/")) return { class: "internal-secret", schemes: ["InternalSecret"], status: "source-inferred" };
  if (apiPath === "/cart/resume") return { class: "cart-recovery-capability", schemes: ["CartCapability", "CartRecoveryToken"], status: "source-inferred" };
  if (/^\/payments\/checkout-intents\//.test(apiPath)) return { class: "payment-attempt-capability", schemes: ["CartCapability", "CheckoutAttemptCapability"], status: "source-inferred" };
  if (apiPath === "/checkout/cod-place-order") return { class: "customer-and-cart-capability", schemes: ["CustomerSession", "CartCapability"], status: "source-inferred" };
  if (apiPath === "/checkout/loyalty-balance") return { class: "customer-session", schemes: ["CustomerSession"], status: "source-inferred" };
  if (/\/webhooks?\//i.test(apiPath) || /\/integrations\/channels\/webhook$/.test(apiPath)) {
    return { class: "provider-signature", schemes: [], status: "source-inferred" };
  }
  if (/\/cron\//.test(apiPath) || apiPath === "/cart/abandonment") {
    return { class: "scheduled-job-credential", schemes: [], status: "source-inferred" };
  }
  if (/requireStaff(?:ApiSession|Session)|getStaffSession|withAdminMutation|requireAdmin/i.test(source) || apiPath.startsWith("/admin/")) {
    return { class: "staff-session", schemes: ["StaffSession"], status: "source-inferred" };
  }
  if (/getStorefrontSession|supabase\.auth\.(?:getUser|getSession)/.test(source) || apiPath.startsWith("/account/") || apiPath.startsWith("/wishlist")) {
    return { class: "customer-session", schemes: ["CustomerSession"], status: "source-inferred" };
  }
  if (apiPath.startsWith("/cart/") || apiPath.startsWith("/checkout/") || apiPath.startsWith("/payments/checkout-intents/")) {
    return { class: "cart-capability", schemes: ["CartCapability"], status: "source-inferred" };
  }
  if (/isSameOriginMutation|verifyRecaptchaAction|applyRateLimit/.test(source)) {
    return { class: "public-origin-protected", schemes: [], status: "source-inferred" };
  }
  if (/^(GET|HEAD)$/.test(method.toUpperCase()) && /\/health(?:\/|$)/.test(apiPath)) {
    return { class: "public", schemes: [], status: "source-inferred" };
  }
  if (/newsletter|back-in-stock|forms\//.test(apiPath) || apiPath.startsWith("/store/")) {
    return { class: "public", schemes: [], status: "source-inferred" };
  }
  return { class: "unclassified", schemes: [], status: "not-documented" };
}

function contractMetadata(method, apiPath, source) {
  const mutation = ["post", "put", "patch", "delete"].includes(method);
  const idempotent = mutation && !apiPath.startsWith("/auth/") && (
    apiPath.startsWith("/admin/") ||
    /withAdminMutationIdempotency|claimAdminIdempotency|requiredIdempotencyKey|idempotency-key/i.test(source)
  );
  const guard = source.match(/requireStaffApiSession(?:Any)?\(\s*["'`]([^"'`]+)|requireStaffSessionWithPermission\(\s*["'`]([^"'`]+)/);
  const workerPermission = source.match(/Worker auth:\s*([^\.\n]+)/i);
  const auth = authenticationMetadata(method, apiPath, source);
  const permission = auth.class === "local-e2e-credentials"
    ? "local-e2e-credentials"
    : guard?.[1] ?? guard?.[2] ?? workerPermission?.[1]?.trim() ?? (auth.class === "staff-session" ? "staff-session" : "not-applicable");
  const webhook = /webhook/i.test(apiPath);
  return {
    operationId: operationId(method, apiPath),
    mutation,
    permission,
    tenantScoped: /resolveStaffOrganization|organization_id|organizationId|store_id|storeId|tenant scope:\s*organization_id/i.test(source),
    idempotent,
    routeReplayProtected: !idempotent || (webhook ? /replay|event_id|eventId|idempotency/i.test(source) : /withAdminMutationIdempotency|claimAdminIdempotency|getIdempotencyKey|requiredIdempotencyKey|idempotency-key/i.test(source)),
    security: auth.schemes,
    authenticationClass: auth.class,
    authenticationStatus: auth.status,
    // A mutation is not automatically a JSON-body contract. DELETE routes and
    // proxy actions frequently take their resource identifier from the path or
    // headers only. Only document a request schema when the handler actually
    // reads a body; otherwise the generated contract must not imply one.
    // Only a request-body read creates a request contract. Broad `.json()`
    // matching incorrectly classified response.json() in bodyless mutations
    // (for example payment retry) as unresolved request schemas.
    bodyContract: mutation && method !== "delete" && !webhook && /parseAdminJson|parseBoundedJson|\b(?:request|req|_req)\.json\s*\(|\b(?:request|req)\.formData\s*\(/i.test(source)
      ? `${operationId(method, apiPath)}Request`
      : null,
    responseContract: `${operationId(method, apiPath)}Response`,
    // These values are source evidence, not an executable authorization or
    // tenancy proof. Keep that distinction in the published contract until a
    // route has an explicit metadata declaration and a matching runtime test.
    metadataStatus: "source-inferred",
  };
}

function rawResponseMediaTypes(source) {
  const types = [];
  if (/Content-Type["'`]\s*:\s*["'`]text\/csv|text\/csv\s*(?:raw|response)/i.test(source)) types.push("text/csv");
  if (/Content-Type["'`]\s*:\s*["'`]text\/event-stream/i.test(source)) types.push("text/event-stream");
  if (/image\/svg\+xml/.test(source)) types.push("image/svg+xml");
  if (/image\/png/.test(source)) types.push("image/png");
  return types;
}

function runtimeStatusCodes(source, method) {
  const codes = new Set([method === "get" ? 200 : 200]);
  for (const match of source.matchAll(/\bstatus\s*:\s*(\d{3})\b/g)) codes.add(Number(match[1]));
  for (const match of source.matchAll(/\bstatus\s*=\s*(\d{3})\b/g)) codes.add(Number(match[1]));
  if (/NextResponse\.redirect\s*\(/.test(source)) codes.add(302);
  return [...codes].filter((code) => code >= 100 && code <= 599).sort((a, b) => a - b);
}

function isRedirectResponse(source) {
  return /NextResponse\.redirect\s*\(/.test(source);
}

function extractZodProperties(source) {
  const properties = {};
  const required = [];
  for (const match of source.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*z\.(string|number|boolean|enum|array|record|object)\s*(?:\(\s*([^)]*)\))?/g)) {
    const [, name, kind, args = ""] = match;
    const property = kind === "number" ? { type: "number" } : kind === "boolean" ? { type: "boolean" } : kind === "array" ? { type: "array", items: {} } : kind === "object" || kind === "record" ? { type: "object" } : { type: "string" };
    if (kind === "enum") {
      const values = [...args.matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
      if (values.length) property.enum = values;
    }
    const tail = source.slice(match.index + match[0].length, match.index + match[0].length + 80);
    if (/\.optional\(\)|\.default\(/.test(tail)) property["x-optional"] = true;
    else required.push(name);
    properties[name] = property;
  }
  return { properties, required };
}

function extractResponseProperties(source) {
  const properties = {};
  for (const match of source.matchAll(/(?:NextResponse\.json|Response\.json|correlatedJson|json)\s*\(\s*\{\s*([\s\S]{0,1400}?)(?:\}\s*,|\}\s*\))/g)) {
    for (const key of match[1].matchAll(/(?:^|[,\n])\s*([A-Za-z_$][\w$]*)\s*:/g)) properties[key[1]] ??= { type: "string" };
  }
  return properties;
}

function zodToOpenApi(schema) {
  const def = schema?._def;
  if (!def) return { schema: { type: "object", additionalProperties: true }, required: [] };
  const typeName = def.typeName;
  if (typeName === "ZodOptional" || typeName === "ZodDefault" || typeName === "ZodNullable") {
    const inner = zodToOpenApi(def.innerType);
    return { schema: typeName === "ZodNullable" ? { anyOf: [inner.schema, { type: "null" }] } : inner.schema, required: [] };
  }
  if (typeName === "ZodEffects") return zodToOpenApi(def.schema);
  if (typeName === "ZodString") {
    const result = { type: "string" };
    for (const check of def.checks ?? []) {
      if (check.kind === "min") result.minLength = check.value;
      if (check.kind === "max") result.maxLength = check.value;
      if (check.kind === "email") result.format = "email";
      if (check.kind === "uuid") result.format = "uuid";
      if (check.kind === "url") result.format = "uri";
      if (check.kind === "regex") result.pattern = String(check.regex ?? "");
    }
    return { schema: result, required: [] };
  }
  if (typeName === "ZodNumber") {
    const result = { type: "number" };
    for (const check of def.checks ?? []) {
      if (check.kind === "min") result.minimum = check.value;
      if (check.kind === "max") result.maximum = check.value;
      if (check.kind === "int") result.type = "integer";
    }
    return { schema: result, required: [] };
  }
  if (typeName === "ZodBoolean") return { schema: { type: "boolean" }, required: [] };
  if (typeName === "ZodEnum") return { schema: { type: "string", enum: def.values }, required: [] };
  if (typeName === "ZodLiteral") return { schema: { const: def.value }, required: [] };
  if (typeName === "ZodArray") {
    const item = zodToOpenApi(def.type);
    const result = { type: "array", items: item.schema };
    for (const check of def.checks ?? []) {
      if (check.kind === "min") result.minItems = check.value;
      if (check.kind === "max") result.maxItems = check.value;
    }
    return { schema: result, required: [] };
  }
  if (typeName === "ZodUnion" || typeName === "ZodDiscriminatedUnion") {
    const options = typeName === "ZodUnion" ? def.options : [...def.options.values()];
    return { schema: { anyOf: options.map((option) => zodToOpenApi(option).schema) }, required: [] };
  }
  if (typeName === "ZodObject") {
    const properties = {};
    const required = [];
    const shape = typeof def.shape === "function" ? def.shape() : def.shape;
    for (const [name, child] of Object.entries(shape ?? {})) {
      const converted = zodToOpenApi(child);
      properties[name] = converted.schema;
      const childType = child?._def?.typeName;
      if (!["ZodOptional", "ZodDefault", "ZodNullable"].includes(childType)) required.push(name);
    }
    return {
      schema: { type: "object", additionalProperties: def.unknownKeys !== "strict", properties, ...(required.length ? { required } : {}) },
      required,
    };
  }
  return { schema: { type: "object", additionalProperties: true }, required: [] };
}

function operationYaml(method, apiPath, tag, source, sourcePath) {
  const contract = contractMetadata(method, apiPath, source);
  const action = method === "get" ? "Read" : method === "post" ? "Create or execute" : method === "delete" ? "Delete" : "Update";
  const lines = [
    `    ${method}:`,
    `      operationId: ${contract.operationId}`,
    `      summary: ${yamlString(`${action} ${titleFromPath(apiPath)}`)}`,
    `      description: ${yamlString(`${titleFromPath(apiPath)}. Contract metadata is derived from the route handler and checked against its runtime controls.`)}`,
    `      tags: [${yamlString(tag)}]`,
    `      x-source-path: ${yamlString(sourcePath)}`,
      `      x-permission: ${yamlString(contract.permission)}`,
    `      x-authentication-class: ${yamlString(contract.authenticationClass)}`,
    `      x-authentication-metadata-status: ${contract.authenticationStatus}`,
    `      x-tenant-scoped: ${contract.tenantScoped ? "true" : "false"}`,
    `      x-idempotency-required: ${contract.idempotent ? "true" : "false"}`,
    `      x-idempotency-persisted: ${contract.routeReplayProtected ? "true" : "false"}`,
    `      x-contract-metadata-status: ${contract.metadataStatus}`,
    "      x-contract-metadata-warning: Permission, tenant scope, and replay fields are static source evidence; they are not a substitute for executable route authorization tests.",
    `      x-runtime-statuses: [${runtimeStatusCodes(source, method).join(", ")}]`,
    `      x-source-sha256: ${sourceHash(source)}`,
    ...(contract.security.length
      ? contract.authenticationClass === "customer-and-cart-capability"
        ? ["      security:", "        - CustomerSession: []", "          CartCapability: []"]
        : ["      security:", ...contract.security.map((scheme) => `        - ${scheme}: []`)]
      : contract.authenticationClass === "public" || contract.authenticationClass === "public-origin-protected" || contract.authenticationClass === "oauth-callback" || contract.authenticationClass === "local-e2e-credentials"
        ? ["      security: []"]
        : []),
  ];
  const params = [...apiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  if (params.length) {
    lines.push("      parameters:");
    for (const parameter of params) {
      lines.push(`        - name: ${parameter}`, "          in: path", "          required: true", "          schema:", "            type: string");
    }
  }
  if (contract.idempotent && !/webhook/i.test(apiPath)) {
    lines.push("        - name: Idempotency-Key", "          in: header", "          required: true", "          schema:", "            type: string", "            minLength: 8", "            maxLength: 200");
  }
  if (contract.bodyContract) {
    if (method === "post" && ["/admin/cms/media", "/admin/catalog/media"].includes(apiPath)) {
      lines.push(
        "      requestBody:",
        "        required: true",
        "        content:",
        "          multipart/form-data:",
        "            schema:",
        "              type: object",
        "              required: [file]",
        "              properties:",
        "                file:",
        "                  type: string",
        "                  format: binary",
      );
      if (apiPath === "/admin/cms/media") lines.push("                alt:", "                  type: string", "                  description: Required for image uploads.");
      else lines.push("                alt:", "                  type: string", "                productId:", "                  type: string");
    } else {
      lines.push("      requestBody:", "        required: true", "        content:", "          application/json:", "            schema:", `              $ref: '#/components/schemas/${contract.bodyContract}'`);
    }
  }
  const rawMediaTypes = rawResponseMediaTypes(source);
  if (rawMediaTypes.length) {
    lines.push("      responses:", '        "200":', "          description: Operation completed successfully.", "          content:");
    for (const mediaType of rawMediaTypes) {
    lines.push(`            ${mediaType}:`, "              schema:", "                type: string", "                format: binary");
    }
    for (const mediaType of rawMediaTypes) {
      if (mediaType === "text/event-stream") {
        const index = lines.lastIndexOf("                format: binary");
        if (index >= 0) lines.splice(index, 1);
      }
    }
    lines.push(
      '        "400":',
      "          description: Invalid request.",
      "          content:",
      "            application/problem+json:",
      "              schema:",
      "                $ref: '#/components/schemas/ProblemResponse'",
      '        "401":',
      "          description: Authentication or permission required.",
      "          content:",
      "            application/problem+json:",
      "              schema:",
      "                $ref: '#/components/schemas/ProblemResponse'",
      '        "500":',
      "          description: Internal operation failure.",
      "          content:",
      "            application/problem+json:",
      "              schema:",
      "                $ref: '#/components/schemas/ProblemResponse'",
    );
    return lines.join("\n");
  }
  if (isRedirectResponse(source)) {
    lines.push(
      "      responses:",
      '        "302":',
      "          description: Redirect response.",
      "          headers:",
      "            Location:",
      "              schema:",
      "                type: string",
      '        "400":',
      "          description: Invalid request.",
      "          content:",
      "            application/problem+json:",
      "              schema:",
      "                $ref: '#/components/schemas/ProblemResponse'",
      '        "401":',
      "          description: Authentication or permission required.",
      "          content:",
      "            application/problem+json:",
      "              schema:",
      "                $ref: '#/components/schemas/ProblemResponse'",
      '        "500":',
      "          description: Internal operation failure.",
      "          content:",
      "            application/problem+json:",
      "              schema:",
      "                $ref: '#/components/schemas/ProblemResponse'",
    );
    return lines.join("\n");
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
    "          content:",
    "            application/problem+json:",
    "              schema:",
    "                $ref: '#/components/schemas/ProblemResponse'",
    '        "401":',
    "          description: Authentication or permission required.",
    "          content:",
    "            application/problem+json:",
    "              schema:",
    "                $ref: '#/components/schemas/ProblemResponse'",
    '        "500":',
    "          description: Internal operation failure.",
    "          content:",
    "            application/problem+json:",
    "              schema:",
    "                $ref: '#/components/schemas/ProblemResponse'",
  );
  return lines.join("\n");
}

function escapeHtml(value) {
  return value.replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

const files = (await routeFiles(apiRoot)).sort();
let contractRegistry = {};
let responseContractRegistry = {};
try {
  const module = await import(pathToFileURL(path.join(root, "apps/web/src/lib/admin-api-contracts.ts")).href);
  contractRegistry = module.adminRequestContracts ?? module.default?.adminRequestContracts ?? {};
  responseContractRegistry = module.adminResponseContracts ?? module.default?.adminResponseContracts ?? {};
} catch (error) {
  // Plain Node remains supported for source-inference-only regeneration. The
  // repository generation command uses tsx so executable contracts are loaded.
  if (process.env.DEBUG_OPENAPI_CONTRACTS === "1") console.warn("[admin-openapi] runtime contracts unavailable", error);
}
const endpoints = [];
for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  const methods = [...source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((match) => match[1].toLowerCase());
  const apiPath = toApiPath(file);
  for (const method of methods) endpoints.push({ method, path: apiPath, tag: tagFromPath(apiPath), source: path.relative(root, file) });
}
if (process.env.DEBUG_OPENAPI_CONTRACTS === "1") console.warn("[admin-openapi] loaded runtime contracts", Object.keys(contractRegistry).length, Boolean(contractRegistry["patch /admin/profile"]));

const groups = [...new Set(endpoints.map((endpoint) => endpoint.tag))].sort();
const yaml = [
  "openapi: 3.1.0",
  "info:",
  "  title: Universal Music Store API",
  "  version: 1.0.0",
  "  description: >",
  "    English reference documentation for storefront, customer, staff, integration, and internal API operations.",
  "",
  "    Endpoints are implemented under the unified web application. Authentication",
  "    varies by operation; see x-authentication-class. Source-inferred metadata is",
  "    documentary evidence only and does not replace runtime authorization tests.",
  "servers:",
  "  - url: /api",
  "    description: Unified web application API",
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
  yaml.push(operationYaml(endpoint.method, apiPath, endpoint.tag, await fs.readFile(path.join(root, endpoint.source), "utf8"), endpoint.source));
  }
}
const schemas = new Map();
for (const endpoint of endpoints) {
  const source = await fs.readFile(path.join(root, endpoint.source), "utf8");
  const contract = contractMetadata(endpoint.method, endpoint.path, source);
  if (contract.bodyContract) {
    const runtimeContract = contractRegistry[`${endpoint.method} ${endpoint.path}`];
    const request = runtimeContract
      ? (() => {
          const converted = zodToOpenApi(runtimeContract);
          return { properties: converted.schema.properties ?? {}, required: converted.required, runtimeSchema: converted.schema };
        })()
      : extractZodProperties(source);
    schemas.set(contract.bodyContract, {
      ...request,
      description: `Validated request payload for ${endpoint.method.toUpperCase()} ${endpoint.path}. Runtime source: ${endpoint.source}.`,
      sourceHash: sourceHash(source),
      inferred: !request.runtimeSchema && request.required.length === 0 && Object.keys(request.properties).length === 0,
      runtimeSchema: request.runtimeSchema,
    });
  }
  const responseProperties = extractResponseProperties(source);
  const runtimeResponseContract = responseContractRegistry[`${endpoint.method} ${endpoint.path}`];
  if (isRedirectResponse(source)) continue;
  if (rawResponseMediaTypes(source).length && !runtimeResponseContract) continue;
  const runtimeResponse = runtimeResponseContract ? zodToOpenApi(runtimeResponseContract) : null;
  schemas.set(contract.responseContract, {
    properties: runtimeResponse?.schema?.properties ?? responseProperties,
    required: runtimeResponse?.required ?? [],
    description: `Response contract for ${endpoint.method.toUpperCase()} ${endpoint.path}. Runtime source: ${endpoint.source}.`,
    sourceHash: sourceHash(source),
    inferred: !runtimeResponse && Object.keys(responseProperties).length === 0,
    runtimeSchema: runtimeResponse?.schema,
  });
}
yaml.push(
  "components:",
  "  securitySchemes:",
  "    StaffSession:",
  "      type: apiKey",
  "      in: header",
  "      name: Cookie",
  "      description: Supabase SSR staff session cookie header; cookie name is project-configured.",
  "    CustomerSession:",
  "      type: apiKey",
  "      in: header",
  "      name: Cookie",
  "      description: Supabase SSR customer session cookie header; cookie name is project-configured.",
  "    CartCapability:",
  "      type: apiKey",
  "      in: header",
  "      name: Cookie",
  "      description: HttpOnly cart capability cookie (mcart_id); possession authorizes access only to its bound cart.",
  "    InternalSecret:",
  "      type: apiKey",
  "      in: header",
  "      name: x-internal-secret",
  "      description: Server-to-server shared secret; never expose to browser clients.",
  "    PreviewCapability:",
  "      type: apiKey",
  "      in: query",
  "      name: token",
  "      description: Short-lived, scoped CMS preview token.",
  "    CartRecoveryToken:",
  "      type: apiKey",
  "      in: query",
  "      name: token",
  "      description: Opaque cart-resume capability validated against cart ownership.",
  "    CheckoutAttemptCapability:",
  "      type: apiKey",
  "      in: header",
  "      name: Cookie",
  "      description: HttpOnly checkout_attempt_id capability scoped to a payment attempt.",
  "  schemas:",
);
for (const [name, schema] of [...schemas.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  yaml.push(
    `    ${name}:`,
    "      type: object",
    `      additionalProperties: ${schema.runtimeSchema ? (schema.runtimeSchema.additionalProperties === true ? "true" : "false") : (schema.inferred ? "true" : "false")}`,
    `      description: ${yamlString(schema.description)}`,
    `      x-source-sha256: ${schema.sourceHash}`,
    `      x-contract-inference: ${schema.runtimeSchema ? "runtime-zod" : (schema.inferred ? "unresolved" : "source-regex")}`,
    `      x-contract-status: ${schema.runtimeSchema ? "executable" : (schema.inferred ? "non-authoritative" : "heuristic")}`,
  );
  if (schema.runtimeSchema?.anyOf) {
    yaml.push("      anyOf:");
    for (const option of schema.runtimeSchema.anyOf) yaml.push(`        - ${JSON.stringify(option)}`);
  }
  const properties = Object.entries(schema.properties);
  if (properties.length) {
    yaml.push("      properties:");
    for (const [property, value] of properties) {
      yaml.push(`        ${property}:`);
      if (value.anyOf) {
        yaml.push("          anyOf:");
        for (const option of value.anyOf) {
          if (option.type) yaml.push(`            - type: ${option.type}`);
          else if (option.const !== undefined) yaml.push(`            - const: ${yamlString(option.const)}`);
        }
      } else {
        yaml.push(`          type: ${value.type ?? "object"}`);
      }
      if (value.enum) yaml.push(`          enum: [${value.enum.map(yamlString).join(", ")}]`);
      if (value.format) yaml.push(`          format: ${value.format}`);
      if (value.minLength !== undefined) yaml.push(`          minLength: ${value.minLength}`);
      if (value.maxLength !== undefined) yaml.push(`          maxLength: ${value.maxLength}`);
      if (value.minimum !== undefined) yaml.push(`          minimum: ${value.minimum}`);
      if (value.maximum !== undefined) yaml.push(`          maximum: ${value.maximum}`);
      if (value.pattern) yaml.push(`          pattern: ${yamlString(value.pattern)}`);
      if (value.const !== undefined) yaml.push(`          const: ${yamlString(value.const)}`);
      if (value.items) yaml.push("          items:", `            type: ${value.items.type ?? "object"}`);
    }
  }
  if (schema.required?.length) yaml.push(`      required: [${schema.required.map(yamlString).join(", ")}]`);
}
yaml.push(
  "    ProblemResponse:",
    "      type: object",
    "      additionalProperties: false",
    "      required: [type, title, status, detail, error, code, requestId, retryable]",
    "      properties:",
    "        type:",
    "          type: string",
    "          format: uri-reference",
    "        title:",
    "          type: string",
    "        status:",
    "          type: integer",
    "          minimum: 400",
    "          maximum: 599",
    "        detail:",
    "          type: string",
    "        error:",
    "          type: string",
    "        code:",
    "          type: string",
    "        requestId:",
    "          type: string",
    "          description: Correlation identifier for support and audit review.",
    "        retryable:",
    "          type: boolean",
);
await fs.writeFile(outputYaml, `${yaml.join("\n")}\n`, "utf8");
if (process.argv.includes("--yaml-only")) {
  console.log(`Generated ${path.relative(root, outputYaml)} for ${endpoints.length} operations.`);
  process.exit(0);
}

const endpointRows = endpoints.map((endpoint) => `<tr><td><code>${endpoint.method.toUpperCase()}</code></td><td><code>${escapeHtml(endpoint.path)}</code></td><td>${escapeHtml(endpoint.tag)}</td><td>${escapeHtml(endpoint.source)}</td></tr>`).join("");
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Universal Music Store API</title><style>
@page { size: A4; margin: 18mm 15mm; } body { font-family: Arial, sans-serif; color: #17202a; font-size: 10px; line-height: 1.45; } h1 { font-size: 26px; margin: 0 0 8px; } h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #d7dee5; padding-bottom: 4px; } h3 { font-size: 12px; margin: 16px 0 5px; } p { margin: 5px 0; } .muted { color: #5d6b78; } .cover { min-height: 235mm; display: flex; flex-direction: column; justify-content: center; } .pill { display: inline-block; background: #e7f0f7; color: #16496b; padding: 4px 8px; border-radius: 12px; margin: 3px 4px 3px 0; } table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; } th, td { border: 1px solid #d7dee5; padding: 5px 6px; text-align: left; vertical-align: top; } th { background: #f0f4f7; } code { font-family: monospace; font-size: 9px; } .break { page-break-before: always; } .note { background: #f6f8fa; border-left: 3px solid #477a9e; padding: 8px; } </style></head><body>
<section class="cover"><div class="pill">OpenAPI 3.1.0</div><h1>Universal Music Store<br>API Reference</h1><p class="muted">Storefront, customer, staff, integration, and internal operations</p><p>Version 1.0.0</p><p class="muted">Generated from the implemented API route tree on ${new Date().toISOString().slice(0, 10)}.</p></section>
<section class="break"><h2>Authentication and Operations</h2><p>Authentication is operation-specific. Inspect each operation's x-authentication-class; source-inferred classifications are documentation hints and must be confirmed against executable authorization tests. Internal signatures and opaque capabilities are intentionally not represented as generic staff credentials.</p><div class="note"><strong>Hardening guidance:</strong> preserve request correlation IDs, audit mutations, redact credentials and payment data, validate payloads server-side, and return least-privilege responses.</div><h3>Authentication schemes</h3><table><thead><tr><th>Scheme</th><th>Transport</th><th>Use</th></tr></thead><tbody><tr><td>StaffSession</td><td>Cookie header</td><td>Supabase SSR staff session.</td></tr><tr><td>CustomerSession</td><td>Cookie header</td><td>Supabase SSR customer session.</td></tr><tr><td>CartCapability</td><td>Cookie header</td><td>HttpOnly cart ownership capability.</td></tr></tbody></table><h3>Tags</h3><p>${groups.map((group) => `<span class="pill">${escapeHtml(group)}</span>`).join("")}</p></section>
<section class="break"><h2>Endpoint Index</h2><p>${endpoints.length} operations discovered from the unified web application's admin route handlers.</p><table><thead><tr><th>Method</th><th>Path</th><th>Domain</th><th>Implementation</th></tr></thead><tbody>${endpointRows}</tbody></table></section>
<section class="break"><h2>Response and Security Contract</h2><h3>Successful responses</h3><p>Each operation has its own request and response schema generated from the route handler source, with strict object boundaries and a runtime source reference. Mutation operations require an Idempotency-Key unless they are signed webhook deliveries.</p><h3>Error responses</h3><table><thead><tr><th>Status</th><th>Meaning</th><th>Required hardening behavior</th></tr></thead><tbody><tr><td>400</td><td>Invalid request</td><td>Validate and reject malformed or unsafe input.</td></tr><tr><td>401</td><td>Unauthenticated or unauthorized</td><td>Do not disclose protected resource details.</td></tr><tr><td>409</td><td>Replay or concurrency conflict</td><td>Do not execute a duplicate side effect.</td></tr><tr><td>413</td><td>Payload too large</td><td>Reject before parsing or persistence.</td></tr><tr><td>500</td><td>Internal failure</td><td>Log with correlation ID and return a safe public message.</td></tr></tbody></table><h3>Source of truth</h3><p class="muted">The companion YAML file is generated from route handlers under <code>apps/web/src/app/api</code>. Contract metadata is emitted per operation so route, permission, tenant, and replay-control drift is visible in review.</p></section>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: outputPdf, format: "A4", printBackground: true, margin: { top: "18mm", right: "15mm", bottom: "18mm", left: "15mm" } });
await browser.close();
console.log(`Generated ${path.relative(root, outputYaml)} and ${path.relative(root, outputPdf)} for ${endpoints.length} operations.`);
