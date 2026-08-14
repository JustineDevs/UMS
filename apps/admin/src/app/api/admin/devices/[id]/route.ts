import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { updateDevice } from "@universal-music-store/platform-data";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { parseAdminJson } from "@/lib/admin-api-security";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { z } from "zod";

const devicePatchSchema = z.object({
  ip_address: z.string().trim().max(64).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
}).strict();

async function patch(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "devices:manage")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return correlatedJson(cid, { error: "Missing id" }, { status: 400 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const parsed = await parseAdminJson(req, devicePatchSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const device = await updateDevice(sup.client, id, parsed.data, organization.id);
  return correlatedJson(cid, { data: device });
}

export const PATCH = withAdminMutationIdempotency("/admin/devices/[id]:PATCH", patch);
