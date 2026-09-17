import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { listCmsCategoryContent } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { listAdminProductCategories } from "@/lib/medusa-product-categories";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const locale = req.nextUrl.searchParams.get("locale")?.trim() || "en";
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  const [cmsRows, categories] = await Promise.all([
    listCmsCategoryContent(sup.client, organization.id),
    listAdminProductCategories(),
  ]);
  const cmsHandles = new Set(
    cmsRows.filter((r) => r.locale === locale).map((r) => r.collection_handle.trim().toLowerCase()),
  );
  const missing = categories.filter((c) => !cmsHandles.has(c.handle.trim().toLowerCase()));
  return correlatedJson(cid, {
    data: {
      locale,
      catalog_count: categories.length,
      cms_rows_for_locale: cmsRows.filter((r) => r.locale === locale).length,
      missing,
    },
  });
}
