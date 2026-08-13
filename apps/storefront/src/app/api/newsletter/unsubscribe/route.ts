import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createStorefrontAnonSupabase } from "@/lib/storefront-supabase";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";

const schema = z.object({ email: z.string().trim().email().max(320) }).strict();

export async function POST(req: NextRequest) {
  const rate = await rateLimitFixedWindow(`newsletter-unsubscribe:${getRequestIp(req)}`, 10, 60_000);
  if (!rate.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  const sb = createStorefrontAnonSupabase();
  if (!sb) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const now = new Date().toISOString();
  const { error } = await sb.from("marketing_preferences").upsert(
    {
      organization_id: process.env.DEFAULT_ORGANIZATION_ID?.trim() || null,
      email: parsed.data.email.toLowerCase(),
      channel: "email",
      consent_status: "unsubscribed",
      source: "unsubscribe",
      unsubscribed_at: now,
      updated_at: now,
    },
    { onConflict: "organization_id,email,channel" },
  );
  if (error) return NextResponse.json({ error: "Unable to update subscription" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
