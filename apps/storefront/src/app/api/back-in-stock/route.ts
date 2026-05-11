import { NextRequest, NextResponse } from "next/server";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, productId, productSlug, variantId } = body as Record<string, unknown>;

  if (typeof email !== "string" || !email.trim().includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (typeof productId !== "string" || !productId.trim()) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Failed to save notification" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
