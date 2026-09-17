import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  getSegmentMembers,
  addSegmentMembers,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseAdminJson, claimAdminIdempotency, completeAdminIdempotency, getIdempotencyKey, getRequestHash } from "@/lib/admin-api-security";
import { z } from "zod";

const membersSchema = z.object({
  members: z.array(z.object({
    customer_email: z.string().trim().toLowerCase().email().max(320),
    medusa_customer_id: z.string().trim().max(200).optional(),
  }).strict()).min(1).max(500),
}).strict();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "crm:segments")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const data = await getSegmentMembers(sb, id, organization.id);
  return correlatedJson(cid, { data });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "crm:segments")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = await parseAdminJson(req, membersSchema);
  if (!parsed.ok) return correlatedJson(cid, { error: parsed.error }, { status: parsed.status });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const organization = await resolveStaffOrganization(sb, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const { data: segment } = await sb.from("customer_segments").select("id").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (!segment) return correlatedJson(cid, { error: "Segment not found" }, { status: 404 });
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) return correlatedJson(cid, { error: "Idempotency-Key is required" }, { status: 400 });
  const claim = await claimAdminIdempotency(sb, { actorKey: `${organization.id}:${session.user.email!.toLowerCase()}`, actionKey: `segment.members:${id}`, idempotencyKey, requestHash: getRequestHash(parsed.data) });
  if (claim.kind === "replay") return correlatedJson(cid, claim.body, { status: claim.status });
  if (claim.kind === "conflict") return correlatedJson(cid, { error: "Idempotency key is already in use" }, { status: 409 });
  if (claim.kind !== "claimed") return correlatedJson(cid, { error: "Idempotency service unavailable" }, { status: 503 });
  try {
    const count = await addSegmentMembers(sb, id, organization.id, parsed.data.members);
    const body = { count };
    await completeAdminIdempotency(sb, claim.id, 200, body);
    return correlatedJson(cid, body);
  } catch {
    const body = { error: "Unable to update segment members" };
    await completeAdminIdempotency(sb, claim.id, 502, body);
    return correlatedJson(cid, body, { status: 502 });
  }
}
