import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { deleteCmsBlogPost } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { cmsBlogBulkSchema } from "@/lib/cms-route-contracts";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseBoundedJson } from "@/lib/bounded-request-body";

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const body = await parseBoundedJson(req, 32 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const parsed = cmsBlogBulkSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid blog bulk payload" }, { status: 400 });
  const ids = parsed.data.ids;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  let deleted = 0;
  for (const id of ids as string[]) {
    const ok = await deleteCmsBlogPost(sup.client, id.trim(), organization.id);
    if (ok) deleted += 1;
  }
  return correlatedJson(cid, { ok: true, deleted });
}

export const POST = withAdminMutationIdempotency("/admin/cms/blog/bulk:POST", post);
