import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  recordVoid,
  listVoids,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { z } from "zod";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const voidSchema = z.object({
  shift_id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  approved_by: z.string().uuid().optional(),
  order_id: z.string().trim().max(120).optional(),
  line_item_id: z.string().trim().max(120).optional(),
  action: z.enum(["void_item", "void_order", "refund", "discount_override"]),
  amount: z.number().finite().nonnegative().max(1_000_000).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  pin_verified: z.boolean().optional(),
}).strict();

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:void")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const shiftId = req.nextUrl.searchParams.get("shift_id") ?? undefined;
  const data = await listVoids(sb, { shiftId, organizationId: organization.id });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:void")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const body = await parseBoundedJson(req, 32 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const parsed = voidSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid void payload" }, { status: 400 });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const v = await recordVoid(sb, { ...parsed.data, organization_id: organization.id });
  return correlatedJson(cid, { data: v }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/voids:POST", post);
