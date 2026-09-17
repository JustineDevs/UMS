import { NextRequest } from "next/server";
import { listCmsPageMutations } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:read");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) {
    return correlatedJson(cid, { error: "Organization membership is not configured" }, { status: 403 });
  }
  const page = await sup.client
    .from("cms_pages")
    .select("id")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (page.error || !page.data) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
  const data = await listCmsPageMutations(sup.client, id, organization.id);
  return correlatedJson(cid, { data });
}
