import { NextResponse } from "next/server";
import { assertStorefrontLinesStock } from "@/lib/storefront-inventory-guard";
import { withBotIdProtection } from "@/lib/botid-protection";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { checkoutVerifyStockResponseSchema, checkoutVerifyStockSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

const MAX_VERIFY_STOCK_BODY_BYTES = 32 * 1024;

/**
 * Server-side stock verification. Called by browser checkout before cart creation
 * because stock authority is now checked by the Worker-backed commerce API.
 */
async function handlePOST(req: Request): Promise<Response> {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json(
      { ok: false, message: "Cross-site mutation rejected", code: "CROSS_SITE_MUTATION" },
      { status: 403 },
    );
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`verify-stock:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many requests", code: "INVENTORY_CHECK_FAILED", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const bounded = await parseBoundedJson(req, MAX_VERIFY_STOCK_BODY_BYTES);
  if (bounded.tooLarge) {
    return NextResponse.json(
      { ok: false, message: "Request body is too large", code: "INVENTORY_CHECK_FAILED" },
      { status: 413 },
    );
  }
  if (!bounded.valid) {
    return NextResponse.json(
      { ok: false, message: "Invalid request body", code: "INVENTORY_CHECK_FAILED" },
      { status: 400 },
    );
  }
  const parsed = checkoutVerifyStockSchema.safeParse(bounded.value);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "No lines provided", code: "INVENTORY_CHECK_FAILED" },
      { status: 400 },
    );
  }

  const lines = parsed.data.lines.map((line) => ({ variantId: line.variantId, quantity: Math.floor(line.quantity) }));

  const result = await assertStorefrontLinesStock(lines);
  return NextResponse.json(checkoutVerifyStockResponseSchema.parse(result));
}

export const POST = withBotIdProtection(handlePOST);
