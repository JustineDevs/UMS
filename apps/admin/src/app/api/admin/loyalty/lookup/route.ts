import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  lookupByQr,
  lookupByPhone,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "loyalty:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const qr = req.nextUrl.searchParams.get("qr");
  const phone = req.nextUrl.searchParams.get("phone");
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;

  if (qr) {
    const account = await lookupByQr(sb, qr);
    if (!account) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
    return correlatedJson(cid, { data: account });
  }
  if (phone) {
    const account = await lookupByPhone(sb, phone);
    if (!account) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
    return correlatedJson(cid, { data: account });
  }
  return correlatedJson(cid, { error: "qr or phone query param required" }, { status: 400 });
}
