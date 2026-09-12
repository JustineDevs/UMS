import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAuthSecret } from "./src/lib/auth-secret";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { ensureStorefrontRuntimeEnvLoaded } = await import(
    "./src/lib/storefront-runtime-env"
  );
  const storefrontDir = path.dirname(fileURLToPath(import.meta.url));
  ensureStorefrontRuntimeEnvLoaded({ cwd: storefrontDir });

  const { assertMedusaStorefrontEnvProduction } = await import(
    "@universal-music-store/sdk"
  );
  assertMedusaStorefrontEnvProduction();

  if (process.env.NODE_ENV === "production") {
    if (!getAuthSecret()) {
      throw new Error("AUTH_SECRET is required in production");
    }
  }
}
