import { redactAdminApiLogDetail } from "./admin-api-log-redact";

export type AdminApiLogPhase = "start" | "ok" | "error";

export function logAdminApiEvent(input: {
  route: string;
  correlationId: string;
  phase: AdminApiLogPhase;
  detail?: Record<string, unknown>;
}): void {
  const safeDetail = redactAdminApiLogDetail(input.detail);
  const line = {
    scope: "admin_api",
    route: input.route,
    requestId: input.correlationId,
    phase: input.phase,
    ...(safeDetail ?? {}),
    ts: new Date().toISOString(),
  };
  console.log(JSON.stringify(line));
}
