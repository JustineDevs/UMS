import { getMedusaAdminBaseUrl, getMedusaSecretApiKey } from "../medusa-env.js";

export function assertAdminMedusaEnvProduction(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (!getMedusaSecretApiKey()) {
    throw new Error(
      "Admin: MEDUSA_SECRET_API_KEY (or MEDUSA_ADMIN_API_SECRET) is required in production.",
    );
  }
  const base = getMedusaAdminBaseUrl().toLowerCase();
  if (base.includes("localhost") || base.includes("127.0.0.1")) {
    throw new Error(
      "Admin: MEDUSA_BACKEND_URL / NEXT_PUBLIC_MEDUSA_URL must be a public HTTPS origin in production (not localhost).",
    );
  }
}
