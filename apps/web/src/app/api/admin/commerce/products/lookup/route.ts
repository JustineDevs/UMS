import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  collectCommerceProductLookupRows,
  parseCommerceProductLookupParams,
} from "@/lib/commerce-product-lookup";
import { fetchWorkerCatalogProductsForAdmin } from "@/lib/worker-admin-bridge";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

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
  const catIds = cats
    .map((c) => (c && typeof c === "object" ? String((c as { id?: string }).id ?? "") : ""))
    .filter(Boolean);
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
    return correlatedJson(cid, { data: { products: filtered } });
  } catch (e) {
    return correlatedJson(
      cid,
      { error: e instanceof Error ? e.message : "Store catalog request unavailable" },
      { status: 502 },
    );
  }
}
