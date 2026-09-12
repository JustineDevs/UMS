import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { listCmsAbExperiments, upsertCmsAbExperiment } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { cmsExperimentSchema } from "@/lib/cms-route-contracts";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:read");
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const data = await listCmsAbExperiments(sup.client, organization.id);
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:write");
  if (!auth.ok) return auth.response;
  const body = await parseBoundedJson(req, 128 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const parsed = cmsExperimentSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid experiment payload" }, { status: 400 });
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const data = await upsertCmsAbExperiment(sup.client, { ...parsed.data, organization_id: organization.id });
  if (!data) return correlatedJson(cid, { error: "Unable to save" }, { status: 500 });
  return correlatedJson(cid, { data });
}

export const POST = withAdminMutationIdempotency("/admin/cms/experiments:POST", post);
