import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { upsertCmsRedirect } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { cmsRedirectBulkSchema } from "@/lib/cms-route-contracts";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseBoundedJson } from "@/lib/bounded-request-body";

async function patch(req: NextRequest) {
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
  const parsed = cmsRedirectBulkSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid redirect bulk payload" }, { status: 400 });
  const { ids, active } = parsed.data;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  let updated = 0;
  for (const id of ids) {
    const { data } = await sup.client.from("cms_redirects").select("*").eq("id", id).eq("organization_id", organization.id).maybeSingle();
    if (!data) continue;
    const r = data as Record<string, unknown>;
    const row = await upsertCmsRedirect(sup.client, {
      id,
      from_path: String(r.from_path ?? ""),
      to_path: String(r.to_path ?? ""),
      status_code: Number(r.status_code) as 301 | 302 | 307 | 308,
      active,
      preserve_query: Boolean(r.preserve_query),
      organization_id: organization.id,
    });
    if (row) updated++;
  }
  return correlatedJson(cid, { data: { updated } });
}

export const PATCH = withAdminMutationIdempotency("/admin/cms/redirects/bulk:PATCH", patch);
