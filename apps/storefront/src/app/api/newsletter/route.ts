import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  insertCmsFormSubmission,
} from "@apparel-commerce/platform-data";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { createStorefrontAnonSupabase } from "@/lib/storefront-supabase";

export async function POST(req: NextRequest) {
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

  if (!submissionId) {
    return NextResponse.json({ error: "Subscription failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: submissionId });
}
