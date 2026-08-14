import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  CMS_MEDIA_TAG_CATALOG_PRODUCT,
  cmsMediaRowIsCatalogProduct,
  findCmsMediaReferences,
  getCmsMediaById,
  softDeleteCmsMedia,
  updateCmsMedia,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { findMedusaProductMediaReferences } from "@/lib/medusa-product-media-refs";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { cmsMediaMetadataSchema } from "@/lib/cms-route-contracts";
import { resolveStaffOrganization } from "@/lib/staff-organization";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  const canContentRead = staffSessionAllows(session, "content:read");
  const canCatalogRead =
    staffSessionAllows(session, "catalog:read") ||
    staffSessionAllows(session, "catalog:write");
  const mode = req.nextUrl.searchParams.get("refs");
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is required" }, { status: 403 });
  const row = await getCmsMediaById(sup.client, id, organization.id);
  if (!row) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
  const isCatalog = cmsMediaRowIsCatalogProduct(row);
  if (!canContentRead && !(isCatalog && canCatalogRead)) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  if (mode === "1") {
    const [cmsRefs, medusaRefs] = await Promise.all([
      findCmsMediaReferences(sup.client, row.public_url, organization.id),
      findMedusaProductMediaReferences(row.public_url),
    ]);
    const refs = [...cmsRefs, ...medusaRefs];
    return correlatedJson(cid, { data: { row, refs } });
  }
  return correlatedJson(cid, { data: row });
}

async function patch(req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(req);
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  const canContentWrite = staffSessionAllows(session, "content:write");
  const canCatalogWrite = staffSessionAllows(session, "catalog:write");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return correlatedJson(cid, { error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = cmsMediaMetadataSchema.safeParse(body);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid media metadata" }, { status: 400 });
  const b = parsed.data;
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is required" }, { status: 403 });
  const existing = await getCmsMediaById(sup.client, id, organization.id);
  if (!existing) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
  const isCatalog = cmsMediaRowIsCatalogProduct(existing);
  if (!canContentWrite && !(isCatalog && canCatalogWrite)) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  let tags = b.tags;
  if (isCatalog && !canContentWrite && tags !== undefined) {
    const merged = new Set(tags);
    merged.add(CMS_MEDIA_TAG_CATALOG_PRODUCT);
    tags = Array.from(merged);
  }
  const row = await updateCmsMedia(sup.client, id, {
    alt_text: b.alt_text,
    display_name: b.display_name,
    tags,
  }, organization.id);
  if (!row) return correlatedJson(cid, { error: "Unable to update" }, { status: 500 });
  return correlatedJson(cid, { data: row });
}

async function deleteHandler(_req: NextRequest, ctx: RouteCtx) {
  const cid = getCorrelationId(_req);
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  const canContentWrite = staffSessionAllows(session, "content:write");
  const canCatalogWrite = staffSessionAllows(session, "catalog:write");
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const organization = await resolveStaffOrganization(sup.client, session.user.email);
  if (!organization) return correlatedJson(cid, { error: "Organization membership is required" }, { status: 403 });
  const existing = await getCmsMediaById(sup.client, id, organization.id);
  if (!existing) return correlatedJson(cid, { error: "Not found" }, { status: 404 });
  const isCatalog = cmsMediaRowIsCatalogProduct(existing);
  if (!canContentWrite && !(isCatalog && canCatalogWrite)) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const [cmsRefs, medusaRefs] = await Promise.all([
    findCmsMediaReferences(sup.client, existing.public_url, organization.id),
    findMedusaProductMediaReferences(existing.public_url),
  ]);
  const references = [...cmsRefs, ...medusaRefs];
  if (references.length > 0) {
    return correlatedJson(
      cid,
      { error: "Media is still referenced by published content or catalog products", code: "MEDIA_IN_USE" },
      { status: 409 },
    );
  }
  const ok = await softDeleteCmsMedia(sup.client, id, organization.id);
  if (!ok) return correlatedJson(cid, { error: "Unable to delete" }, { status: 500 });
  return correlatedJson(cid, { ok: true });
}

export const PATCH = withAdminMutationIdempotency("/admin/cms/media/[id]:PATCH", patch);
export const DELETE = withAdminMutationIdempotency("/admin/cms/media/[id]:DELETE", deleteHandler);
