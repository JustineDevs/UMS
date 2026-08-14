import path from "node:path";
import { fileURLToPath } from "node:url";

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
    if (!process.env.NEXTAUTH_SECRET?.trim()) {
      throw new Error("NEXTAUTH_SECRET is required in production");
    }
    if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
      console.warn(
        "[storefront] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — OAuth sign-in will not work",
      );
    }
  }
}
