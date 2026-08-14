import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * Root path: returns service info. Use /health for health checks.
 */
export async function GET(
  _req: MedusaRequest,
  res: MedusaResponse
) {
  res.json({
    service: "Medusa",
    health: "/health",
    store: "/store",
    admin: "/admin",
  });
}
