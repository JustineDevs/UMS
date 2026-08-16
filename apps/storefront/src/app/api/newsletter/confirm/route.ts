import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return NextResponse.json({ error: "Invalid confirmation link" }, { status: 400 });
  }
  const sb = createStorefrontServiceSupabase();
  if (!sb) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: confirmation } = await sb
    .from("newsletter_confirmations")
    .select("id,organization_id,email,expires_at,confirmed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!confirmation || confirmation.confirmed_at || new Date(String(confirmation.expires_at)).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Confirmation link is invalid or expired" }, { status: 400 });
  }
  const { data: preference } = await sb
    .from("marketing_preferences")
    .select("consent_status")
    .eq("organization_id", confirmation.organization_id)
    .eq("email", confirmation.email)
    .eq("channel", "email")
    .maybeSingle();
  const now = new Date().toISOString();
  const { data: claimed, error: updateError } = await sb
    .from("newsletter_confirmations")
    .update({ confirmed_at: now })
    .eq("id", confirmation.id)
    .is("confirmed_at", null)
    .select("id")
    .maybeSingle();
  if (updateError) return NextResponse.json({ error: "Confirmation failed" }, { status: 503 });
  if (!claimed) return NextResponse.json({ error: "Confirmation link is invalid or expired" }, { status: 400 });
  if (preference?.consent_status === "unsubscribed") {
    return NextResponse.json({ ok: true, suppressed: true });
  }
  const { error: preferenceError } = await sb.from("marketing_preferences").upsert(
    {
      organization_id: confirmation.organization_id,
      email: confirmation.email,
      channel: "email",
      consent_status: "subscribed",
      source: "newsletter-confirmation",
      consented_at: now,
      unsubscribed_at: null,
      updated_at: now,
    },
    { onConflict: "organization_id,email,channel" },
  );
  if (preferenceError) return NextResponse.json({ error: "Confirmation failed" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
