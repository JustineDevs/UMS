import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { listCmsPages, upsertCmsPage, type CmsBlock } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { cmsPageSchema } from "@/lib/cms-route-contracts";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:read");
  if (!auth.ok) return auth.response;
  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const data = await listCmsPages(sup.client, { locale, organizationId: organization.id });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:write");
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return correlatedJson(cid, { error: "Invalid JSON" }, { status: 400 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const parsed = cmsPageSchema.safeParse(body);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid page payload" }, { status: 400 });
  const merged = await upsertCmsPage(sup.client, {
    ...parsed.data,
    blocks: parsed.data.blocks as CmsBlock[] | undefined,
    organization_id: organization.id,
  });
  if (!merged) {
    return correlatedJson(cid, { error: "Unable to save" }, { status: 500 });
  }
  return correlatedJson(cid, { data: merged });
}

export const POST = withAdminMutationIdempotency("/admin/cms/pages:POST", post);
