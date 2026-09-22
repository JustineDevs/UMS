import { NextResponse } from "next/server";
import { storefrontProductSlugSchema } from "@universal-music-store/validation";
import { shopProductResponseSchema } from "@/lib/admin-api-contracts";

import { fetchProductBySlug } from "@/lib/catalog-fetch";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";

function errorResponse(error: string, status: number, retryAfter?: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        ...(retryAfter == null ? {} : { "Retry-After": String(retryAfter) }),
      },
    },
  );
}

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`shop-product:${ip}`, 90, 60_000);
  if (!rl.ok) {
    return errorResponse("Too many requests", 429, rl.retryAfterSec);
  }
  const url = new URL(req.url);
  const slugRaw = url.searchParams.get("slug")?.trim() ?? "";
  const slugParsed = storefrontProductSlugSchema.safeParse(slugRaw);
  if (!slugParsed.success) {
    return errorResponse("Invalid or missing slug", 400);
  }
  const slug = slugParsed.data;
  const res = await fetchProductBySlug(slug);
  if (res.kind === "not_found") {
    return errorResponse("Not found", 404);
  }
  if (res.kind !== "ok") {
    return errorResponse("Service unavailable", 503);
  }
  const product = {
    ...res.product,
    variants: res.product.variants.map((variant) => ({
      ...variant,
      barcode: null,
      cost: null,
    })),
  };
  const parsed = shopProductResponseSchema.safeParse({ product });
  if (!parsed.success) return errorResponse("Product unavailable", 503);
  return NextResponse.json(
    parsed.data,
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
        "Referrer-Policy": "no-referrer",
        "Vary": "Accept-Encoding",
      },
    },
  );
}
