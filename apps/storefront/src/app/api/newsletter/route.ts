import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import {
  insertCmsFormSubmission,
} from "@universal-music-store/platform-data";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import { sendResendTransactionalEmail } from "@universal-music-store/resend-mail";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { createStorefrontAnonSupabase } from "@/lib/storefront-supabase";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import {
  finishPublicDeliveryAttempt,
  publicDeliveryIdempotencyKey,
  recordPublicDeliveryAttempt,
} from "@/lib/public-delivery";
import { withBotIdProtection } from "@/lib/botid-protection";
import {
  isRecaptchaConfigured,
  verifyRecaptchaAction,
} from "@/lib/recaptcha-enterprise";
import { parseBoundedJson } from "@/lib/bounded-request-body";

const MAX_NEWSLETTER_BODY_BYTES = 16 * 1024;

async function handlePOST(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`newsletter:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const bounded = await parseBoundedJson(req, MAX_NEWSLETTER_BODY_BYTES);
  if (bounded.tooLarge) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }
  if (!bounded.valid) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = bounded.value;

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

  const service = createStorefrontServiceSupabase();
  const sb = createStorefrontAnonSupabase() ?? service;
  if (!service || !sb) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM?.trim();
  if (!resendKey || !resendFrom) {
    return NextResponse.json({ error: "Subscription service unavailable" }, { status: 503 });
  }

  const organizationId = process.env.DEFAULT_ORGANIZATION_ID?.trim() || null;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const source = typeof raw.source === "string" ? raw.source.slice(0, 80) : "homepage";
  const { data: confirmation, error: confirmationError } = await service
    .from("newsletter_confirmations")
    .insert({
      organization_id: organizationId,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (confirmationError || !confirmation?.id) {
    return NextResponse.json({ error: "Subscription failed" }, { status: 503 });
  }

  const deliveryKey = publicDeliveryIdempotencyKey(
    "newsletter_confirmation",
    confirmation.id,
  );
  await recordPublicDeliveryAttempt(service, {
    kind: "newsletter_confirmation",
    aggregateId: confirmation.id,
    recipient: email,
    provider: "resend",
    idempotencyKey: deliveryKey,
  });

  const storefrontOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;
  const confirmUrl = `${storefrontOrigin.replace(/\/$/, "")}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
  const sent = await sendResendTransactionalEmail({
    apiKey: resendKey,
    from: resendFrom,
    to: email,
    subject: "Confirm your newsletter subscription",
    html: `<p>Confirm your subscription to receive updates.</p><p><a href="${confirmUrl}">Confirm subscription</a></p><p>This link expires in 24 hours.</p>`,
    idempotencyKey: `newsletter-confirmation:${confirmation.id}`,
  });
  await finishPublicDeliveryAttempt(service, deliveryKey, sent.ok
    ? { status: "sent", providerMessageId: sent.id ?? null }
    : { status: "failed", error: sent.message });
  if (!sent.ok) {
    return NextResponse.json({ error: "Subscription delivery failed" }, { status: 503 });
  }

  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const submissionId = await insertCmsFormSubmission(sb, {
    form_key: "newsletter",
    payload: { email, source, confirmationId: confirmation.id },
    ip_hash: ipHash,
  });
  return NextResponse.json({ ok: true, id: submissionId });
}

export const POST = withBotIdProtection(handlePOST);
