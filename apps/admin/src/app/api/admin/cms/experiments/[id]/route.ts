import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { upsertCmsAbExperiment } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { cmsExperimentSchema } from "@/lib/cms-route-contracts";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseBoundedJson } from "@/lib/bounded-request-body";

type RouteCtx = { params: Promise<{ id: string }> };

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
  const body = await parseBoundedJson(req, 128 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const parsed = cmsExperimentSchema.safeParse(
    body.valid && body.value && typeof body.value === "object" && !Array.isArray(body.value) ? { ...body.value, id } : { id },
  );
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid experiment payload" }, { status: 400 });
  const data = await upsertCmsAbExperiment(sup.client, { ...parsed.data, organization_id: organization.id });
  if (!data) return correlatedJson(cid, { error: "Unable to save" }, { status: 500 });
  return correlatedJson(cid, { data });
}

export const PUT = withAdminMutationIdempotency("/admin/cms/experiments/[id]:PUT", put);
