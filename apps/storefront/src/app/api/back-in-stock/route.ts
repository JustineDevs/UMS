import { NextRequest, NextResponse } from "next/server";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { withBotIdProtection } from "@/lib/botid-protection";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type BackInStockPayload = {
  email: string;
  productId: string;
  productSlug?: string;
  variantId?: string;
};

function parseBackInStockPayload(body: unknown):
  | { success: true; data: BackInStockPayload }
  | { success: false; details: Record<string, string[]> } {
  if (!body || typeof body !== "object") {
    return { success: false, details: { _errors: ["Invalid payload"] } };
  }

  const candidate = body as Record<string, unknown>;
  const errors: Record<string, string[]> = {};

  const email = typeof candidate.email === "string" ? candidate.email.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    errors.email = ["Valid email required"];
  }

  const productId = typeof candidate.productId === "string" ? candidate.productId.trim() : "";
  if (productId.length < 1 || productId.length > 120) {
    errors.productId = ["productId is required"];
  }

  const productSlug =
    typeof candidate.productSlug === "string" ? candidate.productSlug.trim() : undefined;
  if (typeof productSlug === "string" && productSlug.length > 180) {
    errors.productSlug = ["productSlug is too long"];
  }

  const variantId =
    typeof candidate.variantId === "string" ? candidate.variantId.trim() : undefined;
  if (typeof variantId === "string" && variantId.length > 120) {
    errors.variantId = ["variantId is too long"];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, details: errors };
  }

  return {
    success: true,
    data: {
      email,
      productId,
      ...(productSlug ? { productSlug } : {}),
      ...(variantId ? { variantId } : {}),
    },
  };
}

async function handlePOST(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`back-in-stock:${ip}`, 12, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBackInStockPayload(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.details },
      { status: 400 },
    );
  }
  const { email, productId, productSlug, variantId } = parsed.data;

  const supabase = createStorefrontServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await supabase.from("back_in_stock_notifications").upsert(
    {
      email: email.trim().toLowerCase(),
      product_id: productId.trim(),
      product_slug: typeof productSlug === "string" ? productSlug.trim() : null,
      variant_id: typeof variantId === "string" ? variantId.trim() : null,
      notified: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: "email,product_id,variant_id" },
  );

  if (error) {
    console.error("back_in_stock_notifications upsert error:", error.message);
    return NextResponse.json({ error: "Failed to save notification" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withBotIdProtection(handlePOST);
