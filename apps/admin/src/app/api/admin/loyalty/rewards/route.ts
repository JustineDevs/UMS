import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  listRewards,
  createReward,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "loyalty:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const data = await listRewards(sb, { activeOnly: true });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "loyalty:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const parsedBody = await parseBoundedJson(req, 32 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const body = parsedBody.valid && parsedBody.value && typeof parsedBody.value === "object" && !Array.isArray(parsedBody.value) ? parsedBody.value as Record<string, unknown> : {};
  if (!body.name || body.points_cost == null) {
    return correlatedJson(cid, { error: "name and points_cost are required" }, { status: 400 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const reward = await createReward(sb, body as Parameters<typeof createReward>[1]);
  return correlatedJson(cid, { data: reward }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/loyalty/rewards:POST", post);
