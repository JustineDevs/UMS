import { NextResponse } from "next/server";
import { storefrontProductSlugSchema } from "@universal-music-store/validation";

import { fetchProductBySlug } from "@/lib/catalog-fetch";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";

export async function GET(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`shop-product:${ip}`, 90, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const url = new URL(req.url);
  const slugRaw = url.searchParams.get("slug")?.trim() ?? "";
  const slugParsed = storefrontProductSlugSchema.safeParse(slugRaw);
  if (!slugParsed.success) {
    return NextResponse.json(
      { error: "Invalid or missing slug", details: slugParsed.error.flatten() },
      { status: 400 },
    );
  }
  const slug = slugParsed.data;
  const res = await fetchProductBySlug(slug);
  if (res.kind === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (res.kind !== "ok") {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }
  return NextResponse.json({ product: res.product });
}
