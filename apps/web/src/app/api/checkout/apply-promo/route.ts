import { applyRateLimit, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { withBotIdProtection } from "@/lib/botid-protection";
import { validateExistingCartBinding } from "@/lib/cart-session-boundary";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { checkoutApplyPromoResponseSchema, storefrontApplyPromoSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";

async function handler(request: Request): Promise<Response> {
  const limit = await applyRateLimit(request, `promo-${request.method.toLowerCase()}`, 20, 60_000);
  if (!limit.ok) return limit.response;
  if (!isSameOriginMutation(request)) return Response.json({ ok: false, error: "Cross-site mutation rejected", code: "CROSS_SITE" }, { status: 403 });
  const bounded = await parseBoundedJson(request, 4 * 1024);
  if (bounded.tooLarge) return Response.json({ ok: false, error: "Request body is too large", code: "BODY_TOO_LARGE" }, { status: 413 });
  const parsed = storefrontApplyPromoSchema.safeParse(bounded.valid ? bounded.value : undefined);
  if (!parsed.success) return Response.json({ ok: false, error: "cartId and code are required", code: "MISSING_PARAMS" }, { status: 400 });
  const cartId = parsed.data.cartId;
  const code = parsed.data.code.toUpperCase();
  const cookieCartId = await readCartIdFromCookie();
  if (validateExistingCartBinding(cartId, cookieCartId).status !== 200) return Response.json({ ok: false, error: "Cart ownership could not be verified", code: "CART_MISMATCH" }, { status: 403 });
  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) return Response.json({ ok: false, error: "The promotion service is temporarily unavailable.", code: "CONFIG_ERROR" }, { status: 503 });
  try {
    const upstream = await fetch(`${apiUrl}/store/carts/promotion`, { method: request.method, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ cartId, code }), cache: "no-store" });
    const parsed = await readResponseJson<Record<string, unknown>>(upstream, { error: "Invalid promotion response" });
    if (!upstream.ok) {
      const messages: Record<string, string> = { promotion_invalid: `"${code}" is not a valid or active promotion code.`, promotion_expired: `"${code}" is expired.`, promotion_already_applied: `"${code}" is already applied.`, promotion_limit_reached: `"${code}" is no longer available.` };
      return Response.json({ ok: false, error: messages[String(parsed.error)] ?? "That promotion could not be applied.", code: String(parsed.error ?? "PROMOTION_ERROR") }, { status: upstream.status });
    }
    return Response.json(checkoutApplyPromoResponseSchema.parse({ ok: true, discountAmount: parsed.discountAmount ?? 0 }));
  } catch { return Response.json({ ok: false, error: "The promotion service is temporarily unavailable.", code: "REQUEST_FAILED" }, { status: 503 }); }
}

export const POST = withBotIdProtection(handler);
export const DELETE = withBotIdProtection(handler);
