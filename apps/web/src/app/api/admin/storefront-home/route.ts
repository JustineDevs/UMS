import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  getStorefrontHomeContent,
  mergeStorefrontHomePayload,
  upsertStorefrontHomeContent,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { getStaffSession } from "@/lib/requireStaffSession";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function GET(req: Request) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "settings:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const data = await getStorefrontHomeContent(sb);
  return correlatedJson(cid, { data, devMode: process.env.AUTH_DISABLED === "true" });
}

async function put(req: Request) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "settings:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const body = await parseBoundedJson(req, 512 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const merged = mergeStorefrontHomePayload(body.valid ? body.value : null);
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  await upsertStorefrontHomeContent(sb, merged);
  return correlatedJson(cid, { data: merged });
}

export const PUT = withAdminMutationIdempotency("/admin/storefront-home:PUT", put);
