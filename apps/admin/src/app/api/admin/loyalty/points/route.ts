import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  addPoints,
  redeemPoints,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "loyalty:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { account_id, points, reason, order_id, action } = await req.json();
  if (!account_id || points == null || !reason) {
    return correlatedJson(cid, { error: "account_id, points, and reason are required" }, { status: 400 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  if (action === "redeem") {
    const account = await redeemPoints(sb, account_id, Math.abs(points), reason);
    return correlatedJson(cid, { data: account });
  }
  const account = await addPoints(sb, account_id, points, reason, order_id);
  return correlatedJson(cid, { data: account });
}

export const POST = withAdminMutationIdempotency("/admin/loyalty/points:POST", post);
