import { resolveOpaqueTrackingCapability } from "@universal-music-store/sdk";
import { revokeTrackingCapability } from "@universal-music-store/platform-data/tracking-capability-revocation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";

const revokeRequestSchema = z.object({
  token: z.string().trim().min(8).max(4096),
  resourceId: z.string().trim().min(1).max(200),
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();

async function post(request: Request): Promise<Response> {
  const correlationId = getCorrelationId(request);
  const staff = await requireStaffApiSession("orders:write");
  if (!staff.ok) return staff.response;
  const parsed = await parseAdminJson(request, revokeRequestSchema, 16_384);
  if (!parsed.ok) return correlatedJson(correlationId, { error: parsed.error }, { status: parsed.status });
  const rawToken = parsed.data.token;
  const token = rawToken.startsWith("cap_") ? rawToken.slice(4) : rawToken;
  const resourceId = parsed.data.resourceId;
  const resolvedId = token ? resolveOpaqueTrackingCapability(token) : null;
  if (!resolvedId || resolvedId !== resourceId) {
    return correlatedJson(correlationId, { error: "Invalid tracking capability" }, { status: 400 });
  }
  const supabase = adminSupabaseOr503(correlationId);
  if ("response" in supabase) return supabase.response;
  const result = await revokeTrackingCapability(supabase.client, {
    token,
    resourceId,
    revokedBy: staff.session.user?.email ?? null,
    reason: parsed.data.reason ?? null,
  });
  if (!result.ok) {
    return correlatedJson(correlationId, { error: result.error }, { status: 503 });
  }
  return correlatedJson(correlationId, { ok: true, revoked: true });
}

export const POST = withAdminMutationIdempotency(
  "/admin/tracking-capabilities/revoke:POST",
  post,
);
