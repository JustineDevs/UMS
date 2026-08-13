import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { z } from "zod";
import { updateCampaign } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export const dynamic = "force-dynamic";
const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  subject: z.string().trim().max(240).optional(),
  body_template: z.string().max(100_000).optional(),
  is_active: z.boolean().optional(),
  schedule_cron: z.string().trim().max(120).optional(),
  segment_id: z.string().uuid().optional(),
}).strict();
type Ctx = { params: Promise<{ id: string }> };

async function patch(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user?.email) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "campaigns:write")) return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  const parsed = await parseAdminJson(req, patchSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const { id } = await ctx.params;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  if (parsed.data.segment_id) {
    const { data: segment } = await sup.client.from("customer_segments").select("id").eq("id", parsed.data.segment_id).eq("organization_id", organization.id).maybeSingle();
    if (!segment) return correlatedJson(cid, { error: "Segment not found" }, { status: 404 });
  }
  const campaign = await updateCampaign(sup.client, id, organization.id, parsed.data);
  await insertStaffAuditLog(sup.client, { actorEmail: session.user.email, action: "campaign.update", resource: "campaign", resourceId: id, details: parsed.data });
  return correlatedJson(cid, { data: campaign });
}

export const PATCH = withAdminMutationIdempotency("/admin/campaigns/[id]:PATCH", patch);
