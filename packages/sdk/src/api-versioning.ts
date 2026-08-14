export const CURRENT_API_VERSION = "2026-03-31";
export const SUPPORTED_API_VERSIONS = ["2026-03-31"] as const;
export type ApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

export const API_VERSION_HEADER = "x-api-version";
export const DEPRECATION_HEADER = "x-api-deprecated";

export function parseApiVersion(headerValue: string | null | undefined): ApiVersion {
  if (!headerValue) return CURRENT_API_VERSION;
  const v = headerValue.trim();
  if ((SUPPORTED_API_VERSIONS as readonly string[]).includes(v)) {
    return v as ApiVersion;
  }
  return CURRENT_API_VERSION;
}

export function isVersionSupported(version: string): boolean {
  return (SUPPORTED_API_VERSIONS as readonly string[]).includes(version);
}

export function apiVersionHeaders(version: ApiVersion): Record<string, string> {
  const headers: Record<string, string> = {
    [API_VERSION_HEADER]: version,
  };
  if (version !== CURRENT_API_VERSION) {
    headers[DEPRECATION_HEADER] = `Use ${CURRENT_API_VERSION} instead`;
  }
  return headers;
}

export function versionedPath(basePath: string, version?: string): string {
  const v = version ?? CURRENT_API_VERSION;
  return `/v/${v}${basePath.startsWith("/") ? basePath : `/${basePath}`}`;
}
