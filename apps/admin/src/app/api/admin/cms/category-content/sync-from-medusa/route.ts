import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  listCmsCategoryContent,
  upsertCmsCategoryContent,
} from "@universal-music-store/platform-data";
import { listAdminProductCategories } from "@/lib/medusa-product-categories";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export const dynamic = "force-dynamic";

/**
 * Creates missing cms_category_content rows for Medusa product category handles (default locale).
 * Does not overwrite existing rows.
 */
async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const locale =
    req.nextUrl.searchParams.get("locale")?.trim() ||
    process.env.NEXT_PUBLIC_CMS_LOCALE?.trim() ||
    "en";

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });

  const [categories, existing] = await Promise.all([
    listAdminProductCategories(),
    listCmsCategoryContent(sup.client, organization.id),
  ]);

  const keys = new Set(
    existing
      .filter((r) => r.locale === locale)
      .map((r) => r.collection_handle.trim())
      .filter(Boolean),
  );

  let created = 0;
  for (const c of categories) {
    const handle = (c.handle ?? "").trim();
    if (!handle || keys.has(handle)) continue;
    const row = await upsertCmsCategoryContent(sup.client, {
      collection_id: c.id,
      collection_handle: handle,
      locale,
      intro_html: `<p>${escapeHtml(c.name ?? handle)}</p>`,
      blocks: [],
      organization_id: organization.id,
    });
    if (row) {
      keys.add(handle);
      created += 1;
    }
  }

  return correlatedJson(cid, {
    data: { created, locale, totalCategories: categories.length },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const POST = withAdminMutationIdempotency("/admin/cms/category-content/sync-from-medusa:POST", post);
