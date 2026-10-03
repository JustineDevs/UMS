#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://universalmusic.vercel.app";

export const API_SECURITY_CONTRACT = [
  { path: "/api/auth/session", expectedStatuses: [200], cache: "private" },
  { path: "/api/account/profile/status", expectedStatuses: [200, 401], cache: "private" },
  { path: "/api/wishlist", expectedStatuses: [200, 401], cache: "private" },
  { path: "/api/cart/resume", expectedStatuses: [200], cache: "private" },
  { path: "/api/checkout/preview", method: "GET", expectedStatuses: [405], cache: "private" },
  { path: "/api/health", expectedStatuses: [200], cache: "private" },
  { path: "/api/feature-mappings", expectedStatuses: [200], cache: "public" },
];

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function header(response, name) {
  return response.headers?.get?.(name) ?? response.headers?.[name] ?? "";
}

export function validateApiSecurityResponse({ status, headers }, contract, url) {
  const failures = [];
  if (!contract.expectedStatuses.includes(status)) {
    failures.push(`${url} returned unexpected HTTP ${status}`);
  }
  if (status >= 500) failures.push(`${url} returned a server error (${status})`);

  const cacheControl = header({ headers }, "cache-control").toLowerCase();
  if (contract.cache === "private" && !cacheControl.includes("no-store")) {
    failures.push(`${url} is missing cache-control: no-store`);
  }
  if (contract.cache === "public" && !cacheControl.includes("public")) {
    failures.push(`${url} is missing an explicit public cache policy`);
  }
  if (header({ headers }, "x-content-type-options").toLowerCase() !== "nosniff") {
    failures.push(`${url} is missing x-content-type-options: nosniff`);
  }
  if (!/^max-age=\d+/.test(header({ headers }, "strict-transport-security").toLowerCase())) {
    failures.push(`${url} is missing strict-transport-security`);
  }
  const contentSecurityPolicy = header({ headers }, "content-security-policy").toLowerCase();
  if (!contentSecurityPolicy.includes("frame-ancestors 'self'")) {
    failures.push(`${url} is missing a self-only content-security-policy frame-ancestors directive`);
  }
  if (!header({ headers }, "permissions-policy").trim()) {
    failures.push(`${url} is missing permissions-policy`);
  }
  const referrerPolicy = header({ headers }, "referrer-policy").toLowerCase();
  if (!referrerPolicy || !["no-referrer", "strict-origin-when-cross-origin"].includes(referrerPolicy)) {
    failures.push(`${url} is missing an approved referrer-policy`);
  }
  return failures;
}

export async function runChecks({
  baseUrl = process.env.STOREFRONT_URL_PRODUCTION ?? DEFAULT_BASE_URL,
  fetchImpl = fetch,
} = {}) {
  const failures = [];
  const base = normalizeBaseUrl(baseUrl);
  for (const contract of API_SECURITY_CONTRACT) {
    const url = `${base}${contract.path}`;
    try {
      const response = await fetchImpl(url, { method: contract.method ?? "GET", redirect: "manual" });
      failures.push(...validateApiSecurityResponse({ status: response.status, headers: response.headers }, contract, url));
    } catch (error) {
      failures.push(`${url} request failed: ${error.message}`);
    }
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = await runChecks();
  if (failures.length > 0) {
    console.error("Deployed API security contract check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Deployed API security contract passed for ${API_SECURITY_CONTRACT.length} routes.`);
  }
}
