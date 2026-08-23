import { NextResponse } from "next/server";
import { assertStorefrontLinesStock } from "@/lib/storefront-inventory-guard";
import { withBotIdProtection } from "@/lib/botid-protection";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { parseBoundedJson } from "@/lib/bounded-request-body";

export const dynamic = "force-dynamic";

type VerifyStockBody = {
  lines?: Array<{ variantId?: string; quantity?: number }>;
};
const MAX_VERIFY_STOCK_BODY_BYTES = 32 * 1024;

/**
 * Server-side stock verification. Called by browser checkout before cart creation
 * because medusaAdminFetch requires MEDUSA_SECRET_API_KEY (server-only env).
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
  const body = bounded.value as VerifyStockBody;

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json(
      { ok: false, message: "No lines provided", code: "INVENTORY_CHECK_FAILED" },
      { status: 400 },
    );
  }

  const lines = body.lines
    .filter(
      (l): l is { variantId: string; quantity: number } =>
        typeof l.variantId === "string" &&
        l.variantId.trim().length > 0 &&
        typeof l.quantity === "number" &&
        l.quantity > 0,
    )
    .map((l) => ({ variantId: l.variantId.trim(), quantity: Math.floor(l.quantity) }));

  if (lines.length === 0) {
    return NextResponse.json(
      { ok: false, message: "No valid lines provided", code: "INVENTORY_CHECK_FAILED" },
      { status: 400 },
    );
  }

  const result = await assertStorefrontLinesStock(lines);
  return NextResponse.json(result);
}

export const POST = withBotIdProtection(handlePOST);
