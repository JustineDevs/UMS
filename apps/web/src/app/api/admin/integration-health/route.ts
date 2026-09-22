import { getCorrelationId } from "@/lib/request-correlation";
import { fetchWorkerAdminIntegrationHealthForAdmin } from "@/lib/worker-admin-bridge";

export const dynamic = "force-dynamic";

export type IntegrationHealthEntry = {
  provider: string;
  status: "healthy" | "degraded" | "down" | "unconfigured";
  sdkVersion: string | null;
  lastWebhookAt: string | null;
  webhookStatus: "unknown" | "healthy" | "failing";
  envPresent: boolean;
  note: string;
};

/** Worker auth: settings:read. Provider capability status is organization-scoped in the Worker. */
export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = await fetchWorkerAdminIntegrationHealthForAdmin();
  return response ?? new Response(JSON.stringify({ error: "Worker backend is unavailable", requestId: correlationId }), { status: 503, headers: { "Content-Type": "application/json", "x-request-id": correlationId } });
}
