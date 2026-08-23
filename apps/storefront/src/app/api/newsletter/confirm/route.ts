import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";

const confirmationResponseHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Referrer-Policy": "no-referrer",
};

function confirmationResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: confirmationResponseHeaders,
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return confirmationResponse({ error: "Invalid confirmation link" }, 400);
  }
  const sb = createStorefrontServiceSupabase();
  if (!sb) return confirmationResponse({ error: "Service unavailable" }, 503);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: confirmation } = await sb
    .from("newsletter_confirmations")
    .select("id,organization_id,email,expires_at,confirmed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!confirmation || confirmation.confirmed_at || new Date(String(confirmation.expires_at)).getTime() <= Date.now()) {
    return confirmationResponse({ error: "Confirmation link is invalid or expired" }, 400);
  }
  const { data: preference } = await sb
    .from("marketing_preferences")
    .select("consent_status")
    .eq("organization_id", confirmation.organization_id)
    .eq("email", confirmation.email)
    .eq("channel", "email")
    .maybeSingle();
  const now = new Date().toISOString();
  if (preference?.consent_status === "unsubscribed") {
    const { error: suppressedClaimError } = await sb
      .from("newsletter_confirmations")
      .update({ confirmed_at: now })
      .eq("id", confirmation.id)
      .is("confirmed_at", null);
    if (suppressedClaimError) {
      return confirmationResponse({ error: "Confirmation failed" }, 503);
    }
    return confirmationResponse({ ok: true, suppressed: true });
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
  if (preferenceError) return confirmationResponse({ error: "Confirmation failed" }, 503);
  const { data: claimed, error: claimError } = await sb
    .from("newsletter_confirmations")
    .update({ confirmed_at: now })
    .eq("id", confirmation.id)
    .is("confirmed_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) return confirmationResponse({ error: "Confirmation failed" }, 503);
  if (!claimed) return confirmationResponse({ error: "Confirmation link is invalid or expired" }, 400);
  return confirmationResponse({ ok: true });
}
