import { readFile } from "node:fs/promises";
import path from "node:path";

export type OpenApiOperation = {
  method: string;
  path: string;
  summary: string;
  tags: string[];
  authenticationClass: string;
  permission: string;
  tenantScoped: boolean;
};

function documentCandidates() {
  return [
    path.resolve(process.cwd(), ".internal/internal/reference/admin-open-api.yaml"),
    path.resolve(process.cwd(), "../../.internal/internal/reference/admin-open-api.yaml"),
  ];
}

export async function readAdminOpenApiDocument() {
  let lastError: unknown;
  for (const candidate of documentCandidates()) {
    try {
      const yaml = await readFile(candidate, "utf8");
      return { yaml, sourcePath: candidate };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("OpenAPI document could not be loaded");
}

export function extractOpenApiOperations(yaml: string): OpenApiOperation[] {
  const pathMatches = [...yaml.matchAll(/^  (\/[^:\n]+):\s*$/gm)];
  const operations: OpenApiOperation[] = [];

  pathMatches.forEach((pathMatch, index) => {
    const routePath = pathMatch[1];
    const sectionStart = (pathMatch.index ?? 0) + pathMatch[0].length;
    const sectionEnd = pathMatches[index + 1]?.index ?? yaml.length;
    const section = yaml.slice(sectionStart, sectionEnd);
    const methodMatches = [...section.matchAll(/^    (get|post|put|patch|delete|head|options|trace):\s*$/gm)];

    methodMatches.forEach((methodMatch, methodIndex) => {
      const operationStart = (methodMatch.index ?? 0) + methodMatch[0].length;
      const operationEnd = methodMatches[methodIndex + 1]?.index ?? section.length;
      const operation = section.slice(operationStart, operationEnd);
      const summary = operation.match(/^\s{6}summary:\s*(.+)$/m)?.[1]?.trim() ?? "API operation";
      const tags = [...operation.matchAll(/^\s{6}-\s+(.+)$/gm)].map((match) => match[1].trim());
      const authenticationClass = operation.match(/^\s{6}x-authentication-class:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim() ?? "unspecified";
      const permission = operation.match(/^\s{6}x-permission:\s*["']?([^"'\n]+)["']?$/m)?.[1]?.trim() ?? "unspecified";
      const tenantScoped = operation.match(/^\s{6}x-tenant-scoped:\s*(true|false)$/m)?.[1] === "true";
      operations.push({ method: methodMatch[1].toUpperCase(), path: routePath, summary, tags, authenticationClass, permission, tenantScoped });
    });
  });

  return operations;
}
