import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getIdempotencyKey, parseAdminJson } from "@/lib/admin-api-security";
import { createWorkerChatOrderForAdmin } from "@/lib/worker-admin-bridge";
import { adminChatOrderIntakeResponseSchema, adminChatOrderIntakeSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("chat_orders:manage");
  if (!staff.ok) return staff.response;
  const parsed = await parseAdminJson<Record<string, unknown>>(request);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const intakePayload = adminChatOrderIntakeSchema.safeParse(parsed.data);
  if (!intakePayload.success) return correlatedJson(correlationId, { error: "Invalid chat order intake payload" }, { status: 400 });
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) return correlatedJson(correlationId, { error: "Idempotency-Key is required" }, { status: 400 });
  const response = await createWorkerChatOrderForAdmin({ body: intakePayload.data, idempotencyKey });
  if (!response) return correlatedJson(correlationId, { error: "Commerce Worker unavailable" }, { status: 503 });
  const headers = new Headers(response.headers);
  headers.set("x-request-id", correlationId);
  if (!response.ok) return new Response(response.body, { status: response.status, headers });
  const payload = await readResponseJson<unknown>(response, null);
  const validated = adminChatOrderIntakeResponseSchema.safeParse(payload);
  if (!validated.success) return correlatedJson(correlationId, { error: "Invalid Worker response" }, { status: 502 });
  return correlatedJson(correlationId, validated.data, { status: response.status });
}
