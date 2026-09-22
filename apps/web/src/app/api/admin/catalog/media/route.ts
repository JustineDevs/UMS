import { NextRequest } from "next/server";
import { requireStaffApiSession, requireStaffApiSessionAny } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminCatalogMediaResponseSchema, adminCmsMediaItemResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

const MAX_CATALOG_MEDIA_BODY_BYTES = 100 * 1024 * 1024 + 256 * 1024;

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSessionAny(["catalog:read", "catalog:write"]);
  if (!auth.ok) return auth.response;
  const response = await proxyWorkerAdminRoute(req, "/api/admin/catalog/media");
  if (!response.ok) return response;
  const payload = await readResponseJson<unknown>(response, null);
  const parsed = adminCatalogMediaResponseSchema.safeParse({
    ...(payload && typeof payload === "object" ? payload : {}),
    catalogSourceUnavailable: false,
    canWrite: staffSessionAllows(auth.session, "catalog:write"),
  });
  if (!parsed.success) {
    return correlatedJson(cid, { error: "Invalid Worker media response" }, { status: 502 });
  }
  return correlatedJson(cid, parsed.data);
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("catalog:write");
  if (!auth.ok) return auth.response;
  const contentLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_CATALOG_MEDIA_BODY_BYTES) {
    return correlatedJson(cid, { error: "Upload is too large" }, { status: 413 });
  }
  if (!req.headers.get("Idempotency-Key")?.trim()) {
    return correlatedJson(cid, { error: "Idempotency-Key is required" }, { status: 400 });
  }
  return proxyWorkerAdminRoute(req, "/api/admin/catalog/media", adminCmsMediaItemResponseSchema);
}

export const POST = post;
