import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  deleteCmsAnnouncement,
  getCmsAnnouncementAnalyticsMap,
  listCmsAnnouncementsAdmin,
  upsertCmsAnnouncement,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { cmsAnnouncementSchema } from "@/lib/cms-route-contracts";
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
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  const [rows, analyticsMap] = await Promise.all([
    listCmsAnnouncementsAdmin(sup.client, organization.id),
    getCmsAnnouncementAnalyticsMap(sup.client, organization.id),
  ]);
  const analytics: Record<string, { impressions: number; clicks: number; dismisses: number }> = {};
  for (const [k, v] of analyticsMap) {
    analytics[k] = {
      impressions: v.impressions,
      clicks: v.clicks,
      dismisses: v.dismisses,
    };
  }
  return correlatedJson(cid, { data: { rows, analytics } });
}

async function put(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const parsed = cmsAnnouncementSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid announcement payload" }, { status: 400 });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  try {
    await upsertCmsAnnouncement(sup.client, { ...parsed.data, organization_id: organization.id });
  } catch (e) {
    return correlatedJson(
      cid,
      { error: e instanceof Error ? e.message : "Unable to save" },
      { status: 500 },
    );
  }
  const rows = await listCmsAnnouncementsAdmin(sup.client, organization.id);
  const analyticsMap = await getCmsAnnouncementAnalyticsMap(sup.client, organization.id);
  const analytics: Record<string, { impressions: number; clicks: number; dismisses: number }> = {};
  for (const [k, v] of analyticsMap) {
    analytics[k] = {
      impressions: v.impressions,
      clicks: v.clicks,
      dismisses: v.dismisses,
    };
  }
  return correlatedJson(cid, { data: { rows, analytics } });
}

async function deleteHandler(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id")?.trim();
  const locale = req.nextUrl.searchParams.get("locale")?.trim() || "en";
  if (!id) {
    return correlatedJson(cid, { error: "Missing id" }, { status: 400 });
  }
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  const ok = await deleteCmsAnnouncement(sup.client, id, locale, organization.id);
  if (!ok) return correlatedJson(cid, { error: "Unable to delete" }, { status: 500 });
  return correlatedJson(cid, { ok: true });
}

export const PUT = withAdminMutationIdempotency("/admin/cms/announcement:PUT", put);
export const DELETE = withAdminMutationIdempotency("/admin/cms/announcement:DELETE", deleteHandler);
