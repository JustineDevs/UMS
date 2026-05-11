import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { staffSessionAllows } from "@apparel-commerce/database";
import { authOptions } from "@/lib/auth";
import {
  collectCommerceProductLookupRows,
  parseCommerceProductLookupParams,
} from "@/lib/commerce-product-lookup";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
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
  const session = await getServerSession(authOptions);
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
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (query) params.set("q", query);
      params.set(
        "fields",
        "+id,+title,+handle,+thumbnail,+status,+variants,*variants,*variants.prices,*categories",
      );
      const path = `/admin/products?${params.toString()}`;
      const res = await medusaAdminFetch(path);
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          typeof json.message === "string" ? json.message : (res.statusText ?? "Catalog error"),
        );
      }
      const productsRaw = json.products;
      const productsIn = Array.isArray(productsRaw) ? productsRaw : [];
      return productsIn.map(mapCommerceLookupRow);
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
