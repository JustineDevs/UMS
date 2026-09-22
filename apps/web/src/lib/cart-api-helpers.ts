/**
 * Shared utilities for storefront cart API routes.
 * Eliminates duplication of rate-limit wrappers, cart ID validation,
 * cookie management, JSON parsing, and Worker cart API interactions.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readResponseJson } from "./read-response-json";

import { medusaCartIdSchema } from "@universal-music-store/validation";

import { MEDUSA_CART_COOKIE } from "./cart-cookie";
import { medusaMinorToMajor } from "./medusa-money";
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
 * Reads the Worker cart ID from the HttpOnly cookie.
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
 * Writes the Worker cart cookie with consistent options.
 */
export async function writeCartCookie(cartId: string): Promise<void> {
  const jar = await cookies();
  jar.set(MEDUSA_CART_COOKIE, cartId, {
    httpOnly: true,
    // Local production builds are served over HTTP during browser audits. Keep
    // the HttpOnly cart cookie usable there while retaining Secure in every
    // real production deployment.
    secure:
      process.env.NODE_ENV === "production" && process.env.UVS_E2E_LOCAL !== "1",
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

/**
 * Retrieves a Worker cart and maps its flat commerce rows to CartLine[].
 * The Worker is the only commerce origin; the legacy fields argument is retained
 * for callers while the native contract owns the selected data.
 */
export async function retrieveCartLines(
  cartId: string,
): Promise<CartLine[] | null> {
  try {
    const cart = await retrieveWorkerCart(cartId);
    if (!cart) return null;
    const currencyCode = typeof cart.currency_code === "string"
      ? cart.currency_code.toUpperCase()
      : "PHP";
    const items = Array.isArray(cart.items) ? cart.items : [];
    return items.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      const variantId = typeof item.variant_id === "string" ? item.variant_id : "";
      if (!variantId) return [];
      const minor = typeof item.unit_price === "number" || typeof item.unit_price === "string"
        ? Number(item.unit_price)
        : 0;
      const thumbnail = typeof item.thumbnail === "string" && item.thumbnail.trim()
        ? item.thumbnail.trim()
        : undefined;
      return [{
        variantId,
        quantity: typeof item.quantity === "number" && Number.isFinite(item.quantity)
          ? Math.max(1, Math.floor(item.quantity))
          : 1,
        slug: typeof item.product_handle === "string" ? item.product_handle : "item",
        name: typeof item.title === "string" ? item.title : "Item",
        sku: typeof item.variant_sku === "string" && item.variant_sku.trim()
          ? item.variant_sku
          : variantId.slice(-8),
        type: "",
        finish: "",
        price: Number.isFinite(minor) ? medusaMinorToMajor(minor, currencyCode) : 0,
        currencyCode,
        ...(thumbnail ? { thumbnail } : {}),
      } satisfies CartLine];
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves a Worker cart. The legacy fields parameter is ignored by the Worker contract.
 */
export async function retrieveCartRaw(
  cartId: string,
  fields: string,
): Promise<Record<string, unknown> | null> {
  void fields;
  try {
    return await retrieveWorkerCart(cartId);
  } catch (error) {
    if (error instanceof Error && error.message === "cart_not_found") return null;
    throw error;
  }
}

type WorkerCart = {
  id: string;
  region_id?: string | null;
  sales_channel_id?: string | null;
  currency_code?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown> | null;
  items?: Array<Record<string, unknown>>;
};

async function retrieveWorkerCart(cartId: string): Promise<WorkerCart | null> {
  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("worker_api_not_configured");
  const response = await fetch(
    `${baseUrl}/store/carts/${encodeURIComponent(cartId)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (response.status === 404) throw new Error("cart_not_found");
  if (!response.ok) throw new Error(`worker_cart_${response.status}`);
  const payload = await readResponseJson(response, {} as { cart?: WorkerCart });
  return payload.cart ?? null;
}
