import { NextResponse } from "next/server";
import {
  buildTrackingUrl,
  DEFAULT_PUBLIC_SITE_ORIGIN,
} from "@universal-music-store/sdk";

import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { withBotIdProtection } from "@/lib/botid-protection";
import { trackingLinkRouteLogic } from "@/lib/tracking-link-route-logic";
import { readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

async function handlePOST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(
    `tracking-link:${ip}`,
    MAX_PER_WINDOW,
    WINDOW_MS,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const bounded = await parseBoundedJson(req, 4 * 1024);
  if (bounded.tooLarge) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }
  if (!bounded.valid) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = bounded.value as { cartId?: string };

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;
  const result = trackingLinkRouteLogic({
    cartId: typeof body?.cartId === "string" ? body.cartId : "",
    ownedCartId: await readCartIdFromCookie(),
    rateLimited: false,
    retryAfterSec: undefined,
    buildTrackingUrl: (cartId) => buildTrackingUrl(base, cartId, {
      storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim(),
    }),
  });

  return NextResponse.json(result.body, {
    status: result.status,
    ...(result.status === 429 && typeof result.body.retryAfter === "number"
      ? { headers: { "Retry-After": String(result.body.retryAfter) } }
      : {}),
  });
}

export const POST = withBotIdProtection(handlePOST);
