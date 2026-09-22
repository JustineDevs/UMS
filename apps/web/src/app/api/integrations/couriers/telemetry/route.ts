import { NextRequest } from "next/server";
import { proxyWorkerPublicRoute } from "@/lib/worker-public-route-proxy";
import { adminCourierTelemetryResponseSchema } from "@/lib/admin-api-contracts";

export async function POST(req: NextRequest) {
  return proxyWorkerPublicRoute(req, "/api/integrations/couriers/telemetry", adminCourierTelemetryResponseSchema);
}
