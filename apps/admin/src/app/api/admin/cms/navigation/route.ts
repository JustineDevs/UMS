import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import {
  getCmsNavigationDraftPayload,
  getCmsNavigationPayloadAdmin,
  mergeNavigationDraftOverLive,
  normalizeNavigationPayloadInput,
  upsertCmsNavigationDraftPayload,
  upsertCmsNavigationPayload,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { cmsNavigationSchema } from "@/lib/cms-route-contracts";
import { resolveStaffOrganization } from "@/lib/staff-organization";

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:read");
  if (!auth.ok) return auth.response;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  const live = await getCmsNavigationPayloadAdmin(sup.client, organization.id);
  const draft = await getCmsNavigationDraftPayload(sup.client, organization.id);
  const merged = mergeNavigationDraftOverLive(live, draft);
  return correlatedJson(cid, {
    data: merged,
    meta: { hasDraft: draft != null },
  });
}

async function put(req: NextRequest) {
  const cid = getCorrelationId(req);
  const auth = await requireStaffApiSession("content:write");
  if (!auth.ok) return auth.response;
  const parsed = cmsNavigationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid navigation payload" }, { status: 400 });
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, auth.session.user?.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  const rec = parsed.data as Record<string, unknown>;
  try {
    if (rec.mode === "draft") {
      const payload = normalizeNavigationPayloadInput(rec.payload ?? rec);
      await upsertCmsNavigationDraftPayload(sup.client, payload, organization.id);
    } else {
      const payload = normalizeNavigationPayloadInput(parsed.data);
      await upsertCmsNavigationPayload(sup.client, payload, organization.id);
      await upsertCmsNavigationDraftPayload(sup.client, {}, organization.id);
    }
  } catch (e) {
    return correlatedJson(
      cid,
      { error: e instanceof Error ? e.message : "Unable to save" },
      { status: 500 },
    );
  }
  const live = await getCmsNavigationPayloadAdmin(sup.client, organization.id);
  const draft = await getCmsNavigationDraftPayload(sup.client, organization.id);
  const merged = mergeNavigationDraftOverLive(live, draft);
  return correlatedJson(cid, {
    data: merged,
    meta: { hasDraft: draft != null },
  });
}

export const PUT = withAdminMutationIdempotency("/admin/cms/navigation:PUT", put);
