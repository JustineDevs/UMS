import { NextResponse } from "next/server";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import {
  catalogProductFromMedusaRaw,
  minVariantPrice,
} from "@/lib/medusa-catalog-mapper";
import {
  getMedusaPublishableKey,
  getMedusaRegionId,
  getMedusaSalesChannelId,
  withSalesChannelId,
} from "@/lib/storefront-medusa-env";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";

const FIELDS =
  "*variants,*variants.calculated_price,*variants.options,*variants.barcode,*categories,*options,+thumbnail,*images,+metadata,+created_at";

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`search-suggest:${ip}`, 90, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { suggestions: [], error: "rate_limited", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  if (q.length > 100) {
    return NextResponse.json({ suggestions: [] });
  }
  if (!getMedusaPublishableKey()?.trim() || !getMedusaRegionId()?.trim()) {
    return NextResponse.json({ suggestions: [] });
  }
  try {
    const sdk = createStorefrontMedusaSdk();
    const regionId = getMedusaRegionId()!;
    const baseParams = {
      region_id: regionId,
      q,
      limit: 8,
      fields: FIELDS,
    };
    const { products: primary } = await sdk.store.product.list(
      withSalesChannelId({ ...baseParams }) as Parameters<typeof sdk.store.product.list>[0],
    );
    const products =
      (primary?.length ?? 0) > 0 || !getMedusaSalesChannelId()
        ? primary
        : (
            await sdk.store.product.list(baseParams as Parameters<
              typeof sdk.store.product.list
            >[0])
          ).products;
    const suggestions = (products ?? [])
      .map((raw) => {
        const p = catalogProductFromMedusaRaw(raw as never);
        if (!p) return null;
        const imageUrl = p.images?.[0]?.imageUrl?.trim() || undefined;
        return {
          slug: p.slug,
          name: p.name,
          minPrice: minVariantPrice(p),
          imageUrl,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
