export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const [{ getAuthSecret }, { ensureStorefrontRuntimeEnvLoaded, assertWorkerBackendEnvProduction }] = await Promise.all([
    import("./src/lib/auth-secret"),
    import("./src/lib/storefront-runtime-env"),
  ]);
  // Keep path discovery inside the Node-only runtime module so the Edge
  // instrumentation graph contains no Node APIs.
  ensureStorefrontRuntimeEnvLoaded();

  assertWorkerBackendEnvProduction();

  if (process.env.NODE_ENV === "production") {
    if (!getAuthSecret()) {
      throw new Error("AUTH_SECRET is required in production");
    }
  }
}
