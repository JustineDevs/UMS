import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  listLoyaltyAccounts,
  getOrCreateLoyaltyAccount,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "loyalty:read")) {
    return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const tier = req.nextUrl.searchParams.get("tier") as "standard" | "silver" | "gold" | "platinum" | null;
  const data = await listLoyaltyAccounts(sb, { tier: tier ?? undefined });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedError(cid, 401, "Unauthorized", "UNAUTHORIZED");
  if (!staffSessionAllows(session, "loyalty:write")) {
    return correlatedError(cid, 403, "Forbidden", "FORBIDDEN");
  }
  const body = await parseBoundedJson(req, 16 * 1024);
  if (body.tooLarge) return correlatedError(cid, 413, "Payload too large", "VALIDATION_ERROR");
  const raw = body.valid && body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Record<string, unknown> : {};
  const { email, medusa_customer_id } = raw;
  if (!email) {
    return correlatedError(cid, 400, "email is required", "VALIDATION_ERROR");
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const account = await getOrCreateLoyaltyAccount(sb, String(email), typeof medusa_customer_id === "string" ? medusa_customer_id : undefined);
  return correlatedJson(cid, { data: account }, { status: 201 });
}

export const POST = withAdminMutationIdempotency("/admin/loyalty:POST", post);
