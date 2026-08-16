import { NextResponse } from "next/server";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { dispatchBackInStockNotifications } from "@/lib/back-in-stock-delivery";

export const runtime = "nodejs";

function isAuthorized(req: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) return false;
  const auth = req.headers.get("authorization")?.trim();
  const provided = auth?.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : req.headers.get("x-cron-secret")?.trim();
  return provided === configured;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || process.env.RESEND_FROM?.trim();
  const supabase = createStorefrontServiceSupabase();
  if (!apiKey || !from || !supabase) {
    return NextResponse.json({ error: "Back-in-stock delivery unavailable" }, { status: 503 });
  }

  const productId = new URL(req.url).searchParams.get("productId")?.trim();
  let query = supabase
    .from("back_in_stock_notifications")
    .select("id,email,product_slug,variant_id")
    .eq("notified", false)
    .order("created_at", { ascending: true })
    .limit(100);
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load notifications" }, { status: 503 });

  const result = await dispatchBackInStockNotifications(supabase, data ?? [], {
    apiKey,
    from,
    siteOrigin: process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN,
  });
  return NextResponse.json({ ok: true, ...result, inspected: data?.length ?? 0 });
}
