import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { requirePinApproval } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { correlatedJson, tagResponse } from "@/lib/staff-api-response";
import { parseAdminJson } from "@/lib/admin-api-security";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { z } from "zod";

const pinApprovalSchema = z.object({
  approver_employee_id: z.string().uuid(),
  pin: z.string().regex(/^\d{4,8}$/),
  required_role: z.enum(["admin", "manager"]).default("manager"),
}).strict();

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const staff = await requireStaffApiSession("pos:use");
  if (!staff.ok) {
    return tagResponse(staff.response, cid);
  }

  const parsed = await parseAdminJson(req, pinApprovalSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const sessionOrganization = await resolveStaffOrganization(sb, staff.session.user?.email);
  if (!sessionOrganization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  try {
    const result = await requirePinApproval(
      sb,
      parsed.data.approver_employee_id,
      parsed.data.pin,
      parsed.data.required_role,
    );
    return correlatedJson(cid, result);
  } catch {
    return correlatedJson(cid, { error: "Unable to verify PIN approval" }, { status: 503 });
  }
}

export const POST = withAdminMutationIdempotency("/admin/pin-approval:POST", post);
