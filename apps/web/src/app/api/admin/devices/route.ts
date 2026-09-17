import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { listDevices, upsertDevice } from "@universal-music-store/platform-data";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { parseAdminJson } from "@/lib/admin-api-security";
import { z } from "zod";
import { resolveStaffOrganization } from "@/lib/staff-organization";

const deviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["terminal", "printer", "kds", "scanner"]).default("terminal"),
  ip_address: z.string().trim().max(64).optional(),
  is_active: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
}).strict();

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("devices:manage");
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const data = await listDevices(sup.client, organization.id);
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("devices:manage");
  if (!auth.ok) return auth.response;
  const parsed = await parseAdminJson(req, deviceSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const device = await upsertDevice(sup.client, { ...parsed.data, organization_id: organization.id });
  return correlatedJson(cid, { data: device }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/devices:POST", post);
