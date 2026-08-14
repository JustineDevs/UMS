import { MedusaAdminConfigurationError } from "./medusa-admin-configuration-error";
import {
  getMedusaAdminBaseUrl,
  getMedusaSecretApiKey,
} from "./storefront-medusa-env";

export {
  MedusaAdminConfigurationError,
  
} from "./medusa-admin-configuration-error";

/**
 * Medusa Admin API (server-only). Same Basic auth as admin app.
 *
 * Do not import Node fs/dotenv loaders here: this module is reachable from the client bundle via
 * medusa-checkout → medusa-checkout-cart-prep → storefront-inventory-guard. Hydrate repo-root env in
 * next.config.js and instrumentation.ts instead.
 */
function secretApiKeyBasicAuthorization(secret: string): string {
  const payload = `${secret}:`;
  const b64 = Buffer.from(payload, "utf8").toString("base64");
  return `Basic ${b64}`;
}

function logMedusaAdminConfigMissing(): void {
  console.error(
    JSON.stringify({
      level: "error",
      diagnostic_code: "STORE_MEDUSA_ADMIN_SECRET_MISSING",
      msg: "medusaAdminFetch called without MEDUSA_SECRET_API_KEY / MEDUSA_ADMIN_API_SECRET",
    }),
  );
}

export async function medusaAdminFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getMedusaAdminBaseUrl().replace(/\/$/, "");
  const secret = getMedusaSecretApiKey();
  if (!secret) {
    logMedusaAdminConfigMissing();
    throw new MedusaAdminConfigurationError();
  }
  const url = path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init?.headers);
  headers.set("Authorization", secretApiKeyBasicAuthorization(secret));
  if (
    init?.body &&
    init.method !== "GET" &&
    init.method !== "HEAD" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}
