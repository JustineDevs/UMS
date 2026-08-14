import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import {
  listSegments,
  createSegment,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";

const segmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  rule_type: z.enum(["spend_above", "spend_below", "order_count_above", "inactive_days", "product_category", "tier", "manual"]),
  rule_config: z.record(z.string(), z.unknown()).default({}),
  auto_refresh: z.boolean().default(true),
}).strict();

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("crm:segments");
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, auth.session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const data = await listSegments(sb, organization.id);
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("crm:segments");
  if (!auth.ok) return auth.response;
  const parsed = await parseAdminJson(req, segmentSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, auth.session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const segment = await createSegment(sb, { ...parsed.data, organization_id: organization.id });
  return correlatedJson(cid, { data: segment }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/segments:POST", post);
