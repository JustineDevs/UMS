import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  collectCommerceProductLookupRows,
  parseCommerceProductLookupParams,
} from "@/lib/commerce-product-lookup";
import { fetchWorkerCatalogProductsForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError, correlatedJson } from "@/lib/staff-api-response";
import { adminCommerceProductLookupResponseSchema } from "@/lib/admin-api-contracts";

function pickThumb(p: Record<string, unknown>): string | null {
  const img = p.thumbnail ?? p.thumbnail_url;
  if (typeof img === "string" && img) return img;
  const imgs = p.images;
  if (Array.isArray(imgs) && imgs[0] && typeof imgs[0] === "object") {
    const u = (imgs[0] as { url?: string }).url;
    if (typeof u === "string") return u;
  }
  return null;
}

function mapCommerceLookupRow(raw: unknown) {
  const p = raw as Record<string, unknown>;
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const firstSku =
    variants[0] && typeof variants[0] === "object"
      ? String((variants[0] as { sku?: string }).sku ?? "")
      : "";
  const cats = Array.isArray(p.categories) ? p.categories : [];
  const catIds = cats.flatMap((c) => {
    const id = c && typeof c === "object" ? String((c as { id?: string }).id ?? "") : "";
    return id ? [id] : [];
  });
  return {
    id: String(p.id ?? ""),
    title: String(p.title ?? ""),
    handle: String(p.handle ?? ""),
    sku: firstSku,
    status: String(p.status ?? ""),
    thumbnail_url: pickThumb(p),
    category_ids: catIds,
  };
}

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) {
    return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  }
  const can =
    staffSessionAllows(session, "catalog:read") || staffSessionAllows(session, "content:read");
  if (!can) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }
  const lookup = parseCommerceProductLookupParams(req.nextUrl.searchParams);
  try {
    const filtered = await collectCommerceProductLookupRows(lookup, async ({ limit, offset, query }) => {
      const result = await fetchWorkerCatalogProductsForAdmin({
        limit,
        offset,
        q: query,
      });
      if (result.commerceUnavailable) throw new Error("Catalog unavailable");
      return result.products.map(mapCommerceLookupRow);
    });
    const parsed = adminCommerceProductLookupResponseSchema.safeParse({ data: { products: filtered } });
    if (!parsed.success) return correlatedError(cid, 502, "Store catalog returned an invalid lookup response", "SERVICE_UNAVAILABLE");
    return correlatedJson(cid, parsed.data);
    } catch {
    return correlatedJson(
      cid,
      { error: "Store catalog request unavailable", code: "CATALOG_UNAVAILABLE" },
      { status: 502 },
    );
  }
}
