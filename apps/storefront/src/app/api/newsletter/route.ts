import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  insertCmsFormSubmission,
} from "@universal-music-store/platform-data";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { createStorefrontAnonSupabase } from "@/lib/storefront-supabase";
import { withBotIdProtection } from "@/lib/botid-protection";
import {
  isRecaptchaConfigured,
  verifyRecaptchaAction,
} from "@/lib/recaptcha-enterprise";

async function handlePOST(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`newsletter:${ip}`, 5, 60_000);
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  if (!isRecaptchaConfigured()) {
    return NextResponse.json({ error: "Security verification unavailable" }, { status: 503 });
  }
  if (!(await verifyRecaptchaAction(req, raw.recaptchaToken, "signup"))) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const trap = raw._hp ?? raw._honeypot;
  if (trap != null && String(trap).trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const sb = createStorefrontAnonSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const submissionId = await insertCmsFormSubmission(sb, {
    form_key: "newsletter",
    payload: { email, source: typeof raw.source === "string" ? raw.source : "homepage" },
    ip_hash: ipHash,
  });

  await sb.from("marketing_preferences").upsert(
    {
      organization_id: process.env.DEFAULT_ORGANIZATION_ID?.trim() || null,
      email,
      channel: "email",
      consent_status: "subscribed",
      source: typeof raw.source === "string" ? raw.source.slice(0, 80) : "homepage",
      consented_at: new Date().toISOString(),
      unsubscribed_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,email,channel" },
  );

  if (!submissionId) {
    return NextResponse.json({ error: "Subscription failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, id: submissionId });
}

export const POST = withBotIdProtection(handlePOST);
