import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  openShift,
  listShifts,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { z } from "zod";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const openShiftSchema = z.object({
  employee_id: z.string().uuid(),
  device_name: z.string().trim().min(1).max(120).optional(),
  opening_cash: z.number().finite().nonnegative().max(1_000_000).optional(),
}).strict();

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:use")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") as "open" | "closed" | null;
  const data = await listShifts(sb, { status: status ?? undefined, organizationId: organization.id });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:shift_manage")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const body = await parseBoundedJson(req, 16 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const parsed = openShiftSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid shift payload" }, { status: 400 });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const shift = await openShift(sb, { ...parsed.data, organization_id: organization.id });
  return correlatedJson(cid, { data: shift }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/shifts:POST", post);
