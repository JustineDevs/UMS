import { NextResponse } from "next/server";

import {
  getMedusaPublishableKey,
  getMedusaRegionId,
} from "@/lib/storefront-medusa-env";
import {
  applyRateLimit,
  readCartIdFromCookie,
  isValidCartId,
  retrieveCartLines,
} from "@/lib/cart-api-helpers";
import {
  resolveCartResumeCapability,
  validateCartResumeAccess,
} from "@/lib/cart-session-boundary";

export async function GET(req: Request) {
  // This is a read-only hydration request and can run more than once during
  // navigation; keep abuse protection without starving normal storefront flows.
  // Version the bucket when the read budget changes so stale remote counters
  // from an older, stricter deployment cannot lock out normal checkout loads.
  const rl = await applyRateLimit(req, "cart-resume:v3", 300, 60_000);
  if (!rl.ok) return rl.response;

  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("cartId")?.trim();
  const recoveryToken = url.searchParams.get("token")?.trim() ?? "";
  const fromCookie = await readCartIdFromCookie();
  const capabilityCartId = resolveCartResumeCapability(recoveryToken);
  const requestedCartId = fromQuery || capabilityCartId;
  if (
    requestedCartId &&
    (!isValidCartId(requestedCartId) ||
      !validateCartResumeAccess(requestedCartId, fromCookie, recoveryToken))
  ) {
    return NextResponse.json(
      { error: "Cart ownership could not be verified" },
      { status: 403 },
    );
  }
  const cartId =
    requestedCartId && isValidCartId(requestedCartId)
      ? requestedCartId
      : fromCookie && isValidCartId(fromCookie)
        ? fromCookie
        : "";

  if (!cartId) {
    return NextResponse.json({
      lines: [],
      cartId: null as string | null,
      source: "local",
      available: true,
      stale: false,
    });
  }

  if (!getMedusaPublishableKey()?.trim() || !getMedusaRegionId()?.trim()) {
    return NextResponse.json({
      lines: [],
      cartId,
      source: "server",
      available: false,
      stale: true,
      skipped: true,
    });
  }

  const lines = await retrieveCartLines(cartId);
  if (lines === null) {
    return NextResponse.json({
      lines: [],
      cartId,
      source: "server",
      available: false,
      stale: true,
      error: "unavailable",
    });
  }

  return NextResponse.json({
    lines,
    cartId,
    source: "server",
    available: true,
    stale: false,
  });
}
