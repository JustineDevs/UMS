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
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "loyalty:write")) {
    return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  }
  const parsedBody = await parseBoundedJson(req, 16 * 1024);
  if (parsedBody.tooLarge) return correlatedError(cid, 413, "Payload too large", "VALIDATION_ERROR");
  const raw = parsedBody.valid && parsedBody.value && typeof parsedBody.value === "object" && !Array.isArray(parsedBody.value) ? parsedBody.value as Record<string, unknown> : {};
  const { account_id, points, reason, order_id, action } = raw;
  if (!account_id || points == null || !reason) {
    return correlatedError(cid, 400, "account_id, points, and reason are required", "VALIDATION_ERROR");
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  if (action === "redeem") {
    const account = await redeemPoints(sb, String(account_id), Math.abs(Number(points)), String(reason));
    return correlatedJson(cid, { data: account });
  }
  const account = await addPoints(sb, String(account_id), Number(points), String(reason), typeof order_id === "string" ? order_id : undefined);
  return correlatedJson(cid, { data: account });
}

export const POST = withAdminMutationIdempotency("/admin/loyalty/points:POST", post);
