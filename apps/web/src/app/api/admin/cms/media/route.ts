import { NextRequest } from "next/server";
import { requireStaffApiSessionAny } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import { adminCmsMediaResponseSchema, adminCmsMediaItemResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

const MAX_CMS_MEDIA_BODY_BYTES = 25 * 1024 * 1024 + 256 * 1024;

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSessionAny([
    "content:read",
    "catalog:read",
    "catalog:write",
  ]);
  if (!auth.ok) return auth.response;
  const response = await proxyWorkerAdminRoute(req, "/api/admin/cms/media");
  if (!response.ok) return response;
  const payload = await readResponseJson<{ data?: unknown } | null>(response, null);
  const parsed = adminCmsMediaResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return correlatedJson(cid, { error: "Invalid Worker media response" }, { status: 502 });
  }
  return correlatedJson(cid, parsed.data, { status: response.status });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSessionAny(["content:write", "catalog:write"]);
  if (!auth.ok) return auth.response;
  const contentLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_CMS_MEDIA_BODY_BYTES) {
    return correlatedJson(cid, { error: "Upload is too large" }, { status: 413 });
  }
  if (!req.headers.get("Idempotency-Key")?.trim()) {
    return correlatedJson(cid, { error: "Idempotency-Key is required" }, { status: 400 });
  }
  const response = await proxyWorkerAdminRoute(req, "/api/admin/cms/media");
  if (!response.ok) return response;
  const payload = await readResponseJson<unknown>(response, null);
  const parsed = adminCmsMediaItemResponseSchema.safeParse(payload);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid Worker media response" }, { status: 502 });
  return correlatedJson(cid, parsed.data, { status: response.status });
}

export const POST = post;
