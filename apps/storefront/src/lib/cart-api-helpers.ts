/**
 * Shared utilities for storefront cart API routes.
 * Eliminates duplication of rate-limit wrappers, cart ID validation,
 * cookie management, JSON parsing, and Medusa SDK interactions.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { medusaCartIdSchema } from "@universal-music-store/validation";

import { MEDUSA_CART_COOKIE } from "./cart-cookie";
import { createStorefrontMedusaSdk } from "./medusa-sdk";
import { medusaCartToCartLines } from "./medusa-cart-to-lines";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "./storefront-api-rate-limit";
import type { CartLine } from "./cart";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * Applies IP-based rate limiting and returns a 429 response when exceeded.
 */
export async function applyRateLimit(
  req: Request,
  routeKey: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`${routeKey}:${ip}`, max, windowMs);
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests", retryAfter: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      ),
    };
  }
  return { ok: true };
}

/**
 * Applies a secondary user-scoped rate limit keyed by email hash.
 */
export async function applyUserRateLimit(
  email: string,
  routeKey: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const h = hashEmail(email);
  const rl = await rateLimitFixedWindow(`${routeKey}:user:${h}`, max, windowMs);
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests", retryAfter: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      ),
    };
  }
  return { ok: true };
}

function hashEmail(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

/**
 * Reads the Medusa cart ID from the HttpOnly cookie.
 * Returns null if no valid cart_ ID is present.
 */
export async function readCartIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const val = jar.get(MEDUSA_CART_COOKIE)?.value?.trim();
  return isValidCartId(val) ? val : null;
}

/**
 * Validates a cart ID string (from body or query).
 */
export function isValidCartId(id: unknown): id is string {
  return medusaCartIdSchema.safeParse(id).success;
}

/**
 * Writes the Medusa cart cookie with consistent options.
 */
export async function writeCartCookie(cartId: string): Promise<void> {
  const jar = await cookies();
  jar.set(MEDUSA_CART_COOKIE, cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearCartCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(MEDUSA_CART_COOKIE);
}

/**
 * Safely parses the request JSON body.
 * Returns the parsed value or a 400 response.
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const body = (await req.json()) as T;
    return { ok: true, data: body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
}

const FULL_LINE_FIELDS =
  "*items,*items.unit_price,*items.quantity,*items.variant,*items.variant.product,*items.variant.options,*items.product";

/**
 * Retrieves a Medusa cart and maps it to display-ready CartLine[].
 * Returns null if the SDK is not configured or the cart does not exist.
 */
export async function retrieveCartLines(
  cartId: string,
): Promise<CartLine[] | null> {
  try {
    const sdk = createStorefrontMedusaSdk();
    const { cart } = await sdk.store.cart.retrieve(cartId, {
      fields: FULL_LINE_FIELDS,
    } as never);
    return medusaCartToCartLines(cart);
  } catch {
    return null;
  }
}

/**
 * Retrieves a Medusa cart with specific fields (for slim queries).
 */
export async function retrieveCartRaw(
  cartId: string,
  fields: string,
): Promise<Record<string, unknown> | null> {
  try {
    const sdk = createStorefrontMedusaSdk();
    const { cart } = await sdk.store.cart.retrieve(cartId, {
      fields,
    } as never);
    return cart as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}
