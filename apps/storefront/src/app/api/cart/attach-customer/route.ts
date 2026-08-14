import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";
import {
  applyRateLimit,
  applyUserRateLimit,
  readCartIdFromCookie,
} from "@/lib/cart-api-helpers";
import { extractSessionEmail } from "@universal-music-store/sdk";

/** IP window kept long enough that sequential E2E bursts under load still hit 429 before the window resets. */
const ATTACH_CUSTOMER_IP_WINDOW_MS = 300_000;

export async function POST(req: Request) {
  const rl = await applyRateLimit(req, "cart-attach", 25, ATTACH_CUSTOMER_IP_WINDOW_MS);
  if (!rl.ok) return rl.response;

  const session = await getServerSession(authOptions);
  const email = extractSessionEmail(session);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRl = await applyUserRateLimit(email, "cart-attach", 15, 60_000);
  if (!userRl.ok) return userRl.response;

  const cartId = await readCartIdFromCookie();
  if (!cartId) {
    return NextResponse.json({ ok: false, skipped: true });
  }

  try {
    const sdk = createStorefrontMedusaSdk();
    await sdk.store.cart.update(cartId, { email });
    return NextResponse.json({ ok: true, cartId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("MEDUSA_SECRET_API_KEY")) {
      return NextResponse.json({ ok: false, skipped: true });
    }
    console.error("[cart/attach-customer] unhandled:", msg.slice(0, 300));
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 503 });
  }
}
