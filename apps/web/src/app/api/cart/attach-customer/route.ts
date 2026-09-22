import { NextResponse } from "next/server";
import { getStorefrontSession } from "@/lib/auth";
import {
  applyRateLimit,
  applyUserRateLimit,
  readCartIdFromCookie,
} from "@/lib/cart-api-helpers";
import { extractSessionEmail } from "@universal-music-store/sdk";
import { isSameOriginMutation } from "@/lib/request-origin";
import { cartEmailMatchesOwner } from "@/lib/cart-session-boundary";
import { cartAttachCustomerResponseSchema } from "@/lib/admin-api-contracts";

/** IP window kept long enough that sequential E2E bursts under load still hit 429 before the window resets. */
const ATTACH_CUSTOMER_IP_WINDOW_MS = 300_000;

export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json(
      { error: "Cross-site mutation rejected" },
      { status: 403 },
    );
  }

  // Authorization must be evaluated before throttling. Otherwise an
  // unauthenticated caller can receive 429 from a shared IP bucket instead
  // of the route's stable 401 contract, which also makes security monitoring
  // indistinguishable from an authenticated abuse event.
  const session = await getStorefrontSession();
  const email = extractSessionEmail(session);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await applyRateLimit(
    req,
    "cart-attach",
    25,
    ATTACH_CUSTOMER_IP_WINDOW_MS,
  );
  if (!rl.ok) return rl.response;

  const userRl = await applyUserRateLimit(email, "cart-attach", 15, 60_000);
  if (!userRl.ok) return userRl.response;

  const cartId = await readCartIdFromCookie();
  if (!cartId) {
    return NextResponse.json(cartAttachCustomerResponseSchema.parse({ ok: false, skipped: true }));
  }

  try {
    const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
    if (!baseUrl) throw new Error("worker_api_not_configured");
    const read = await fetch(
      `${baseUrl}/store/carts/${encodeURIComponent(cartId)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (read.status === 404) {
      return NextResponse.json(cartAttachCustomerResponseSchema.parse({ ok: false, skipped: true }));
    }
    if (!read.ok) throw new Error(`worker_cart_${read.status}`);
    const payload = (await read.json()) as { cart?: { email?: unknown } };
    if (!cartEmailMatchesOwner(payload.cart?.email, email)) {
      return NextResponse.json(
        { error: "Cart ownership could not be verified" },
        { status: 403 },
      );
    }
    const update = await fetch(
      `${baseUrl}/store/carts/${encodeURIComponent(cartId)}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": `storefront-cart-attach-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ email }),
        cache: "no-store",
      },
    );
    if (!update.ok) throw new Error(`worker_cart_update_${update.status}`);
    return NextResponse.json(cartAttachCustomerResponseSchema.parse({ ok: true, cartId }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cart/attach-customer] unhandled:", msg.slice(0, 300));
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 503 },
    );
  }
}
