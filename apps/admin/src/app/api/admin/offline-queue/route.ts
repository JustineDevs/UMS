import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  listPendingQueue,
  enqueueOfflineSale,
  markSynced,
  markFailed,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

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
  const deviceName = req.nextUrl.searchParams.get("device") ?? undefined;
  const data = await listPendingQueue(sb, { deviceName });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:use")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  if (!body.device_name || !body.payload) {
    return correlatedJson(cid, { error: "device_name and payload are required" }, { status: 400 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const item = await enqueueOfflineSale(sb, body);
  return correlatedJson(cid, { data: item }, { status: 201 });
}

async function patch(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "pos:use")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const { id, action, error_message } = await req.json();
  if (!id || !action) {
    return correlatedJson(cid, { error: "id and action required" }, { status: 400 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  if (action === "synced") {
    await markSynced(sb, id);
  } else if (action === "failed") {
    await markFailed(sb, id, error_message ?? "Unknown error");
  }
  return correlatedJson(cid, { success: true });
}

export const POST = withAdminMutationIdempotency("/admin/offline-queue:POST", post);
export const PATCH = withAdminMutationIdempotency("/admin/offline-queue:PATCH", patch);
