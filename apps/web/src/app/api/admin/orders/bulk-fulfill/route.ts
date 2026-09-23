import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { adminBulkFulfillmentResponseSchema, adminBulkFulfillmentSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";
import { mutateWorkerBulkFulfillmentForAdmin } from "@/lib/worker-admin-bridge";

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "orders:fulfill")) return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  const parsed = await parseAdminJson(req, adminBulkFulfillmentSchema, 64 * 1024);
  if (!parsed.ok) return correlatedError(cid, parsed.status, parsed.error, "VALIDATION_ERROR");
  const key = req.headers.get("Idempotency-Key")?.trim();
  if (!key) return correlatedError(cid, 400, "Idempotency-Key is required", "BAD_REQUEST");
  const response = await mutateWorkerBulkFulfillmentForAdmin(parsed.data, key, cid);
  if (!response) return correlatedError(cid, 503, "Commerce Worker is unavailable", "SERVICE_UNAVAILABLE");
  const payload = await readResponseJson<unknown>(response, null);
  if (response.ok) {
    const validated = adminBulkFulfillmentResponseSchema.safeParse(payload);
    if (!validated.success) return correlatedError(cid, 502, "Invalid Worker response", "SERVICE_UNAVAILABLE");
    return correlatedJson(cid, validated.data, { status: response.status });
  }
  return correlatedJson(cid, payload && typeof payload === "object" ? payload : { error: "Commerce Worker request failed" }, { status: response.status });
}

export const POST = post;
