export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { assertAdminMedusaEnvProduction } = await import(
    "@universal-music-store/sdk"
  );
  const { getAdminAuthSecret } = await import("./src/lib/auth-secret");
  assertAdminMedusaEnvProduction();

  if (process.env.NODE_ENV === "production") {
    if (!getAdminAuthSecret()) {
      throw new Error("Admin: AUTH_SECRET is required in production");
    }
  }
}
