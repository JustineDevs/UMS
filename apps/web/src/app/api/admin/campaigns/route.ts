import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import {
  listCampaigns,
  createCampaign,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { validateCampaignAgainstMedusaPromotions } from "@/lib/campaign-medusa-governance";
import { parseAdminJson } from "@/lib/admin-api-security";
import { insertStaffAuditLog } from "@/lib/staff-audit";
import { z } from "zod";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("campaigns:read");
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, auth.session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const type = req.nextUrl.searchParams.get("type") ?? undefined;
  const data = await listCampaigns(sb, { type: type as "winback" | "birthday" | undefined, organizationId: organization.id });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("campaigns:write");
  if (!auth.ok) return auth.response;
  const schema = z.object({
    name: z.string().trim().min(1).max(160),
    type: z.enum(["winback", "birthday", "first_purchase", "upsell", "custom"]),
    segment_id: z.string().uuid().nullable().optional(),
    subject: z.string().trim().max(240).nullable().optional(),
    body_template: z.string().max(100_000).nullable().optional(),
    schedule_cron: z.string().trim().max(120).nullable().optional(),
  }).strict();
  const parsed = await parseAdminJson(req, schema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const body = parsed.data;
  const gov = await validateCampaignAgainstMedusaPromotions({
    bodyTemplate: String(body.body_template ?? ""),
    subject: String(body.subject ?? ""),
  });
  if (!gov.ok) {
    return correlatedJson(
      cid,
      {
        error: "Campaign copy references codes not present in Medusa promotions",
        governance: gov,
      },
      { status: 409 },
    );
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, auth.session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  if (body.segment_id) {
    const { data: segment } = await sb.from("customer_segments").select("id").eq("id", body.segment_id).eq("organization_id", organization.id).maybeSingle();
    if (!segment) return correlatedJson(cid, { error: "Segment not found" }, { status: 404 });
  }
  const campaign = await createCampaign(sb, {
    ...body,
    segment_id: body.segment_id ?? undefined,
    subject: body.subject ?? undefined,
    body_template: body.body_template ?? undefined,
    schedule_cron: body.schedule_cron ?? undefined,
    organization_id: organization.id,
  });
  await insertStaffAuditLog(sb, {
    actorEmail: auth.session.user.email ?? "unknown",
    action: "campaign.create",
    resource: "campaign",
    resourceId: campaign.id,
    details: { name: campaign.name, type: campaign.type, segment_id: campaign.segment_id },
  });
  return correlatedJson(cid, { data: campaign }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/campaigns:POST", post);
