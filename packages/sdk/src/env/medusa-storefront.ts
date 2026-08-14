import {
  getMedusaPublishableKey,
  getMedusaRegionId,
  getMedusaSalesChannelId,
  getMedusaSecretApiKey,
  getMedusaStoreBaseUrl,
} from "../medusa-env.js";

const STOREFRONT_DEPLOY_ENV_HINT =
  "Configure these on the host (Vercel/Render env UI), not only local .env.local files. See repo docs for the Medusa storefront env checklist.";

export function listMissingMedusaStorefrontEnv(): string[] {
  const missing: string[] = [];
  if (!getMedusaPublishableKey()) {
    missing.push(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (or MEDUSA_PUBLISHABLE_API_KEY)",
    );
  }
  if (!getMedusaRegionId()) {
    missing.push("NEXT_PUBLIC_MEDUSA_REGION_ID (or MEDUSA_REGION_ID)");
  }
  if (process.env.NODE_ENV === "production") {
    const base = getMedusaStoreBaseUrl().toLowerCase();
    if (base.includes("localhost") || base.includes("127.0.0.1")) {
      missing.push(
        "NEXT_PUBLIC_MEDUSA_URL / MEDUSA_BACKEND_URL must be a public HTTPS origin in production (not localhost)",
      );
    }
    if (!getMedusaSalesChannelId()) {
      missing.push(
        "NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID (or MEDUSA_SALES_CHANNEL_ID) so listings, carts, and Medusa seed use the same channel",
      );
    }
    if (!getMedusaSecretApiKey()) {
      missing.push(
        "MEDUSA_SECRET_API_KEY (or MEDUSA_ADMIN_API_SECRET) for server-side checkout, totals, and inventory checks against Medusa Admin API",
      );
    }
  }
  return missing;
}

export function assertMedusaStorefrontEnvProduction(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const missing = listMissingMedusaStorefrontEnv();
  if (missing.length > 0) {
    throw new Error(
      `Medusa storefront: required env missing: ${missing.join("; ")}. ${STOREFRONT_DEPLOY_ENV_HINT}`,
    );
  }
}
