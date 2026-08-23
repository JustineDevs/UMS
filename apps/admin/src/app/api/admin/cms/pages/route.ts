import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getCmsPageById, getCmsPageBySlugAdmin, listCmsPages, upsertCmsPage, type CmsBlock } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { cmsPageSchema } from "@/lib/cms-route-contracts";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:read");
  if (!auth.ok) return auth.response;
  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;
  const slug = req.nextUrl.searchParams.get("slug") ?? undefined;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  if (slug) {
    const page = await getCmsPageBySlugAdmin(sup.client, slug, locale ?? "en", organization.id);
    return correlatedJson(cid, { data: page ? [page] : [] });
  }
  const data = await listCmsPages(sup.client, { locale, organizationId: organization.id });
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:write");
  if (!auth.ok) return auth.response;
  const parsedBody = await parseBoundedJson(req, 512 * 1024);
  if (parsedBody.tooLarge) return correlatedJson(cid, { error: "Request body is too large" }, { status: 413 });
  if (!parsedBody.valid) return correlatedJson(cid, { error: "Invalid JSON" }, { status: 400 });
  const body = parsedBody.value;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  const parsed = cmsPageSchema.safeParse(body);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid page payload" }, { status: 400 });
  if (parsed.data.expectedVersion !== undefined) {
    const current = parsed.data.id
      ? await getCmsPageById(sup.client, parsed.data.id, organization.id)
      : await getCmsPageBySlugAdmin(sup.client, parsed.data.slug, parsed.data.locale, organization.id);
    if (current && current.version !== parsed.data.expectedVersion) {
      return correlatedJson(
        cid,
        { error: "Page changed elsewhere", code: "STALE_VERSION", version: current.version },
        { status: 409 },
      );
    }
  }
  const merged = await upsertCmsPage(sup.client, {
    ...parsed.data,
    expectedVersion: parsed.data.expectedVersion,
    blocks: parsed.data.blocks as CmsBlock[] | undefined,
    mutations: parsed.data.mutations,
    organization_id: organization.id,
  });
  if (!merged) {
    return correlatedJson(cid, { error: "Unable to save" }, { status: 500 });
  }
  return correlatedJson(cid, { data: merged });
}

export const POST = withAdminMutationIdempotency("/admin/cms/pages:POST", post);
