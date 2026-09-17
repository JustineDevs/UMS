import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { staffSessionAllows } from "@universal-music-store/database";
import type { CmsBlock } from "@universal-music-store/platform-data";
import {
  insertCmsPageBlockPreset,
  listCmsPageBlockPresets,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { getStaffSession } from "@/lib/requireStaffSession";
import { cmsPresetSchema } from "@/lib/cms-route-contracts";
import { resolveStaffOrganization } from "@/lib/staff-organization";
import { parseBoundedJson } from "@/lib/bounded-request-body";

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
  const data = await listCmsPageBlockPresets(sup.client, organization.id);
  return correlatedJson(cid, { data });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  if (!staffSessionAllows(session, "content:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const body = await parseBoundedJson(req, 512 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const parsed = cmsPresetSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid preset payload" }, { status: 400 });
  const { name, blocks } = parsed.data as { name: string; blocks: CmsBlock[] };
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization required" }, { status: 403 });
  const row = await insertCmsPageBlockPreset(sup.client, {
    name,
    blocks,
    organizationId: organization.id,
  });
  if (!row) {
    return correlatedJson(cid, { error: "Unable to save preset" }, { status: 500 });
  }
  return correlatedJson(cid, { data: row });
}

export const POST = withAdminMutationIdempotency("/admin/cms/block-presets:POST", post);
