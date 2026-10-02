import { NextRequest } from "next/server";
import { requireStaffApiSessionAny } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { proxyWorkerAdminRoute } from "@/lib/worker-admin-route-proxy";
import {
  adminCmsMediaDeleteResponseSchema,
  adminCmsMediaDetailResponseSchema,
  adminCmsMediaItemResponseSchema,
} from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const [{ id }, auth] = await Promise.all([
    ctx.params,
    requireStaffApiSessionAny(["catalog:read", "catalog:write"]),
  ]);
  if (!auth.ok) return auth.response;
  if (!staffSessionAllows(auth.session, "catalog:read") && !staffSessionAllows(auth.session, "catalog:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const response = await proxyWorkerAdminRoute(
    req,
    `/api/admin/catalog/media/${encodeURIComponent(id)}`,
  );
  if (!response.ok) return response;
  const parsed = adminCmsMediaDetailResponseSchema.safeParse(
    await readResponseJson<unknown>(response, null),
  );
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid Worker media response" }, { status: 502 });
  return correlatedJson(cid, parsed.data, { status: response.status });
}

async function patch(req: NextRequest, ctx: RouteCtx) {
  const [{ id }, auth] = await Promise.all([
    ctx.params,
    requireStaffApiSessionAny(["catalog:write"]),
  ]);
  if (!auth.ok) return auth.response;
  if (!req.headers.get("Idempotency-Key")?.trim()) {
    return correlatedJson(getCorrelationId(req), { error: "Idempotency-Key is required" }, { status: 400 });
  }
  const response = await proxyWorkerAdminRoute(
    req,
    `/api/admin/catalog/media/${encodeURIComponent(id)}`,
  );
  if (!response.ok) return response;
  const parsed = adminCmsMediaItemResponseSchema.safeParse(
    await readResponseJson<unknown>(response, null),
  );
  if (!parsed.success) return correlatedJson(getCorrelationId(req), { error: "Invalid Worker media response" }, { status: 502 });
  return correlatedJson(getCorrelationId(req), parsed.data, { status: response.status });
}

async function deleteHandler(req: NextRequest, ctx: RouteCtx) {
  const [{ id }, auth] = await Promise.all([
    ctx.params,
    requireStaffApiSessionAny(["catalog:write"]),
  ]);
  if (!auth.ok) return auth.response;
  if (!req.headers.get("Idempotency-Key")?.trim()) {
    return correlatedJson(getCorrelationId(req), { error: "Idempotency-Key is required" }, { status: 400 });
  }
  const response = await proxyWorkerAdminRoute(
    req,
    `/api/admin/catalog/media/${encodeURIComponent(id)}`,
  );
  if (!response.ok) return response;
  const parsed = adminCmsMediaDeleteResponseSchema.safeParse(
    await readResponseJson<unknown>(response, null),
  );
  if (!parsed.success) return correlatedJson(getCorrelationId(req), { error: "Invalid Worker media response" }, { status: 502 });
  return correlatedJson(getCorrelationId(req), parsed.data, { status: response.status });
}

export const PATCH = patch;
export const DELETE = deleteHandler;
