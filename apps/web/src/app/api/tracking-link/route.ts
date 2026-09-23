import { NextResponse } from "next/server";
import {
  buildTrackingUrl,
  DEFAULT_PUBLIC_SITE_ORIGIN,
} from "@universal-music-store/sdk";

import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { trackingLinkRouteLogic } from "@/lib/tracking-link-route-logic";
import { readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { storefrontTrackingLinkSchema, trackingLinkResponseSchema } from "@/lib/admin-api-contracts";

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
  const parsed = storefrontTrackingLinkSchema.safeParse(bounded.value);
  if (!parsed.success) return NextResponse.json({ error: "cartId is required" }, { status: 400 });

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;
  const result = trackingLinkRouteLogic({
    cartId: parsed.data.cartId,
    ownedCartId: await readCartIdFromCookie(),
    rateLimited: false,
    retryAfterSec: undefined,
    buildTrackingUrl: (cartId) => buildTrackingUrl(base, cartId, {
      storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim(),
    }),
  });

  const body = result.status === 200 ? trackingLinkResponseSchema.parse(result.body) : result.body;
  return NextResponse.json(body, {
    status: result.status,
    ...(result.status === 429 && typeof result.body.retryAfter === "number"
      ? { headers: { "Retry-After": String(result.body.retryAfter) } }
      : {}),
  });
}

// The cart cookie and same-origin ownership checks are the security boundary
// for this handoff. BotID is intentionally not applied here: hosted checkout
// calls this route immediately after cart binding, and privacy-hardened or
// automated browsers can be legitimate users whose provider handoff must not
// be rejected as a bot.
export const POST = handlePOST;
