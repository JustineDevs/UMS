import { NextResponse } from "next/server";

import { getMedusaPublishableKey, getMedusaRegionId } from "@/lib/storefront-medusa-env";
import {
  applyRateLimit,
  readCartIdFromCookie,
  isValidCartId,
  retrieveCartLines,
} from "@/lib/cart-api-helpers";
import { validateCartResumeQuery } from "@/lib/cart-session-boundary";

export async function GET(req: Request) {
  // This is a read-only hydration request and can run more than once during
  // navigation; keep abuse protection without starving normal storefront flows.
  // Version the bucket when the read budget changes so stale remote counters
  // from an older, stricter deployment cannot lock out normal checkout loads.
  const rl = await applyRateLimit(req, "cart-resume:v3", 300, 60_000);
  if (!rl.ok) return rl.response;

  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("cartId")?.trim();
  const fromCookie = await readCartIdFromCookie();
  if (fromQuery && (!isValidCartId(fromQuery) || !validateCartResumeQuery(fromQuery, fromCookie))) {
    return NextResponse.json(
      { error: "Cart ownership could not be verified" },
      { status: 403 },
    );
  }
  const cartId =
    fromQuery && isValidCartId(fromQuery)
      ? fromQuery
      : fromCookie && isValidCartId(fromCookie)
        ? fromCookie
        : "";

  if (!cartId) {
    return NextResponse.json({ lines: [], cartId: null as string | null });
  }

  if (!getMedusaPublishableKey()?.trim() || !getMedusaRegionId()?.trim()) {
    return NextResponse.json({ lines: [], cartId, skipped: true });
  }

  const lines = await retrieveCartLines(cartId);
  if (lines === null) {
    return NextResponse.json({ lines: [], cartId, error: "unavailable" });
  }

  return NextResponse.json({ lines, cartId });
}
