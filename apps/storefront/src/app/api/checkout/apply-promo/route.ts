import {
  getMedusaStoreBaseUrl,
  getMedusaPublishableKey,
} from "@/lib/storefront-medusa-env";
import { applyRateLimit, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { withBotIdProtection } from "@/lib/botid-protection";
import { validateExistingCartBinding } from "@/lib/cart-session-boundary";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

type PromoBody = {
  cartId?: string;
  code?: string;
};

function parsePromoBody(body: unknown): PromoBody {
  if (!body || typeof body !== "object") {
    return {};
  }
  const candidate = body as Record<string, unknown>;
  return {
    cartId: typeof candidate.cartId === "string" ? candidate.cartId.trim().slice(0, 120) : undefined,
    code: typeof candidate.code === "string" ? candidate.code.trim().slice(0, 64) : undefined,
  };
}

/**
 * POST /api/checkout/apply-promo
 * Applies a promotion code to an active Medusa cart via the Medusa Store API.
 * Cart promotions endpoint: POST /store/carts/:cartId/promotions
 *
 * Body: { cartId: string; code: string }
 * Returns: { ok: true; discountAmount?: number } | { ok: false; error: string; code: string }
 */
async function handlePOST(req: Request) {
  const rl = await applyRateLimit(req, "apply-promo", 20, 60_000);
  if (!rl.ok) return rl.response;
  if (!isSameOriginMutation(req)) {
    return Response.json({ ok: false, error: "Cross-site mutation rejected", code: "CROSS_SITE" }, { status: 403 });
  }

  const bounded = await parseBoundedJson(req, 4 * 1024);
  if (bounded.tooLarge) return Response.json({ ok: false, error: "Request body is too large", code: "BODY_TOO_LARGE" }, { status: 413 });
  const body = parsePromoBody(bounded.valid ? bounded.value : {});
  const cartId = body.cartId;
  const code = body.code;

  if (!cartId || !code) {
    return Response.json(
      { ok: false, error: "cartId and code are required", code: "MISSING_PARAMS" },
      { status: 400 },
    );
  }

  const cookieCartId = await readCartIdFromCookie();
  if (validateExistingCartBinding(cartId, cookieCartId).status !== 200) {
    return Response.json(
      { ok: false, error: "Cart ownership could not be verified", code: "CART_MISMATCH" },
      { status: 403 },
    );
  }

  const baseUrl = getMedusaStoreBaseUrl();
  const publishableKey = getMedusaPublishableKey();

  if (!baseUrl || !publishableKey) {
    return Response.json(
      { ok: false, error: "Store configuration error", code: "CONFIG_ERROR" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(
      `${baseUrl}/store/carts/${encodeURIComponent(cartId)}/promotions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableKey,
        },
        body: JSON.stringify({ promo_codes: [code] }),
      },
    );

    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { message: text };
    }

    if (!res.ok) {
      const errorMsg = mapMedusaPromoError(json, code);
      return Response.json(
        { ok: false, error: errorMsg, code: "MEDUSA_ERROR" },
        { status: res.status === 404 ? 422 : res.status < 500 ? 422 : 502 },
      );
    }

    const cart = json.cart as Record<string, unknown> | undefined;
    const discountAmount = extractDiscountAmount(cart);
    return Response.json({ ok: true, discountAmount });
  } catch {
    return Response.json(
      { ok: false, error: "The promotion service is temporarily unavailable.", code: "REQUEST_FAILED" },
      { status: 502 },
    );
  }

}

/**
 * DELETE /api/checkout/apply-promo
 * Removes a promotion code from an active Medusa cart.
 * Body: { cartId: string; code: string }
 */
async function handleDELETE(req: Request) {
  const rl = await applyRateLimit(req, "remove-promo", 20, 60_000);
  if (!rl.ok) return rl.response;
  if (!isSameOriginMutation(req)) {
    return Response.json({ ok: false, error: "Cross-site mutation rejected", code: "CROSS_SITE" }, { status: 403 });
  }

  const bounded = await parseBoundedJson(req, 4 * 1024);
  if (bounded.tooLarge) return Response.json({ ok: false, error: "Request body is too large", code: "BODY_TOO_LARGE" }, { status: 413 });
  const body = parsePromoBody(bounded.valid ? bounded.value : {});
  const cartId = body.cartId;
  const code = body.code;

  if (!cartId || !code) {
    return Response.json(
      { ok: false, error: "cartId and code are required", code: "MISSING_PARAMS" },
      { status: 400 },
    );
  }

  const cookieCartId = await readCartIdFromCookie();
  if (validateExistingCartBinding(cartId, cookieCartId).status !== 200) {
    return Response.json(
      { ok: false, error: "Cart ownership could not be verified", code: "CART_MISMATCH" },
      { status: 403 },
    );
  }

  const baseUrl = getMedusaStoreBaseUrl();
  const publishableKey = getMedusaPublishableKey();

  if (!baseUrl || !publishableKey) {
    return Response.json(
      { ok: false, error: "Store configuration error", code: "CONFIG_ERROR" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(
      `${baseUrl}/store/carts/${encodeURIComponent(cartId)}/promotions`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableKey,
        },
        body: JSON.stringify({ promo_codes: [code] }),
      },
    );

    if (!res.ok) {
      await res.text();
      return Response.json(
        { ok: false, error: "The promotion could not be removed.", code: "MEDUSA_ERROR" },
        { status: 422 },
      );
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, error: "The promotion service is temporarily unavailable.", code: "REQUEST_FAILED" },
      { status: 502 },
    );
  }

}

export const POST = withBotIdProtection(handlePOST);
export const DELETE = withBotIdProtection(handleDELETE);

function mapMedusaPromoError(json: Record<string, unknown>, code: string): string {
  const raw = typeof json.message === "string" ? json.message.trim() : "";
  if (!raw) return `Promotion code "${code}" is not valid or cannot be applied.`;
  if (/not found|invalid|expired|inactive|doesn.t exist/i.test(raw)) {
    return `"${code}" is not a valid or active promotion code.`;
  }
  if (/already applied|duplicate/i.test(raw)) {
    return `"${code}" is already applied.`;
  }
  if (/minimum|threshold|requirement/i.test(raw)) {
    return `Your order does not meet the minimum requirement for "${code}".`;
  }
  return `Promotion code "${code}" could not be applied.`;
}

function extractDiscountAmount(cart: Record<string, unknown> | undefined): number | undefined {
  if (!cart) return undefined;
  const adj = cart.promotions as Array<{ amount?: number }> | undefined;
  if (!adj) return undefined;
  const total = adj.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  return total > 0 ? total : undefined;
}
