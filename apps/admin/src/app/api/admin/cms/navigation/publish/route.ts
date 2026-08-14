import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  getCmsNavigationPayloadAdmin,
  publishCmsNavigationDraft,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  const canPublish =
    staffSessionAllows(session, "content:publish") ||
    staffSessionAllows(session, "content:write");
  if (!canPublish) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  try {
    await publishCmsNavigationDraft(sup.client, organization.id);
  } catch (e) {
    return correlatedJson(
      cid,
      { error: e instanceof Error ? e.message : "Unable to publish" },
      { status: 500 },
    );
  }
  const data = await getCmsNavigationPayloadAdmin(sup.client, organization.id);
  return correlatedJson(cid, { data, meta: { hasDraft: false } });
}

export const POST = withAdminMutationIdempotency("/admin/cms/navigation/publish:POST", post);
