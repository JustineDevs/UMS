import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { enqueueJob } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { validateCampaignAgainstMedusaPromotions } from "@/lib/campaign-medusa-governance";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { getIdempotencyKey } from "@/lib/admin-api-security";
import { resolveStaffOrganization } from "@/lib/staff-organization";

type Ctx = { params: Promise<{ id: string }> };

async function post(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user)
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "campaigns:execute")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const executionKey = getIdempotencyKey(req);
  if (!executionKey) {
    return correlatedJson(
      cid,
      { error: "Idempotency-Key is required" },
      { status: 400 },
    );
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const { data: campRow } = await sb
    .from("campaigns")
    .select("subject,body_template,execution_key,execution_status")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!campRow)
    return correlatedJson(
      cid,
      { error: "Campaign not found" },
      { status: 404 },
    );
  if (
    campRow.execution_key === executionKey &&
    campRow.execution_status === "completed"
  ) {
    return correlatedJson(cid, { sent: 0, replayed: true });
  }
  const { data: claimed, error: claimError } = await sb
    .from("campaigns")
    .update({ execution_key: executionKey, execution_status: "running" })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .or(
      `execution_status.eq.idle,execution_status.eq.failed,execution_key.eq.${executionKey}`,
    )
    .select("id")
    .maybeSingle();
  if (claimError || !claimed)
    return correlatedJson(
      cid,
      { error: "Campaign is already executing" },
      { status: 409 },
    );
  const gov = await validateCampaignAgainstMedusaPromotions({
    bodyTemplate: String(campRow?.body_template ?? ""),
    subject: String(campRow?.subject ?? ""),
  });
  if (!gov.ok) {
    await sb
      .from("campaigns")
      .update({ execution_status: "failed" })
      .eq("id", id)
      .eq("organization_id", organization.id)
      .eq("execution_key", executionKey);
    return correlatedJson(
      cid,
      {
        error:
          "Campaign copy references codes not present in Medusa promotions",
        governance: gov,
      },
      { status: 409 },
    );
  }
  const jobId = await enqueueJob(
    sb,
    "campaign.execute",
    {
      campaignId: id,
      organizationId: organization.id,
      executionKey,
    },
    session.user.email ?? undefined,
  );
  if (!jobId) {
    await sb
      .from("campaigns")
      .update({ execution_status: "failed" })
      .eq("id", id)
      .eq("execution_key", executionKey)
      .eq("organization_id", organization.id);
    return correlatedJson(
      cid,
      { error: "Campaign could not be queued" },
      { status: 503 },
    );
  }
  await insertStaffAuditLog(sb, {
    actorEmail: session.user.email ?? "unknown",
    action: "campaign.execute",
    resource: "campaign",
    resourceId: id,
    details: { queued: true, jobId },
  });
  return correlatedJson(cid, { queued: true, jobId }, { status: 202 });
}

export const POST = withAdminMutationIdempotency("/admin/campaigns/[id]/execute:POST", post);
