import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { deleteCmsPageBlockPreset } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

type RouteCtx = { params: Promise<{ id: string }> };

async function deleteHandler(_req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(_req);
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
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  const ok = await deleteCmsPageBlockPreset(sup.client, id, organization.id);
  if (!ok) {
    return correlatedJson(cid, { error: "Unable to delete" }, { status: 500 });
  }
  return correlatedJson(cid, { ok: true });
}

export const DELETE = withAdminMutationIdempotency("/admin/cms/block-presets/[id]:DELETE", deleteHandler);
