import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  deleteCmsPage,
  getCmsPageById,
  upsertCmsPage,
  type CmsBlock,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { cmsPageSchema } from "@/lib/cms-route-contracts";
import { parseBoundedJson } from "@/lib/bounded-request-body";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const data = await getCmsPageById(sup.client, id, organization.id);
  if (!data) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
  return correlatedJson(cid, { data });
}

async function put(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const parsedBody = await parseBoundedJson(req, 512 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(cid, { error: "Request body is too large" }, { status: 413 });
  if (!parsedBody.valid) return correlatedJson(cid, { error: "Invalid JSON" }, { status: 400 });
  const body = parsedBody.value;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const parsed = cmsPageSchema.safeParse(
    body && typeof body === "object" && !Array.isArray(body) ? { ...body, id } : { id },
  );
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid page payload" }, { status: 400 });
  const merged = await upsertCmsPage(sup.client, {
    ...parsed.data,
    expectedVersion: parsed.data.expectedVersion,
    blocks: parsed.data.blocks as CmsBlock[] | undefined,
    mutations: parsed.data.mutations,
    organization_id: organization.id,
  });
  if (!merged) {
    const current = await getCmsPageById(sup.client, id, organization.id);
    return correlatedJson(
      cid,
      { error: current ? "Page changed elsewhere; reload before saving" : "Unable to save" },
      { status: current ? 409 : 500 },
    );
  }
  return correlatedJson(cid, { data: merged });
}

async function deleteHandler(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const ok = await deleteCmsPage(sup.client, id, organization.id);
  if (!ok) return correlatedJson(cid, { error: "Unable to delete" }, { status: 500 });
  return correlatedJson(cid, { ok: true });
}

export const PUT = withAdminMutationIdempotency("/admin/cms/pages/[id]:PUT", put);
export const DELETE = withAdminMutationIdempotency("/admin/cms/pages/[id]:DELETE", deleteHandler);
