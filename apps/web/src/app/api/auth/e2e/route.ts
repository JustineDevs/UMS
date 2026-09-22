import { NextRequest, NextResponse } from "next/server";
import { createE2eSessionValue, e2eSessionCookieOptions } from "@/lib/e2e-session";
import { E2E_SESSION_COOKIE } from "@/lib/e2e-session-constants";
import { firstAdminAllowedEmail, isAdminE2eCredentialsConfigured } from "@/lib/admin-allowed-emails";
import { tryCreateSupabaseClient } from "@universal-music-store/database";
import { timingSafeEqual } from "node:crypto";
import { parseBoundedJson } from "@/lib/bounded-request-body";
import { e2eAuthRequestSchema } from "@/lib/e2e-auth-contract";

export const dynamic = "force-dynamic";
const MAX_E2E_AUTH_BODY_BYTES = 4 * 1024;

function sameSecret(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!isAdminE2eCredentialsConfigured() || process.env.UVS_E2E_REAL_SESSION !== "1") {
    return NextResponse.json({ error: "E2E authentication is disabled" }, { status: 404 });
  }
  const bounded = await parseBoundedJson(request, MAX_E2E_AUTH_BODY_BYTES);
  if (!bounded.valid || bounded.tooLarge) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = e2eAuthRequestSchema.safeParse(bounded.value);
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, password } = body.data;
  const allowed = firstAdminAllowedEmail()?.trim().toLowerCase();
  const authSecret = process.env.AUTH_SECRET?.trim();
  if (!email || !password || !allowed || !authSecret || email !== allowed || !sameSecret(password, authSecret)) {
    return NextResponse.json({ error: "Invalid E2E credentials" }, { status: 401 });
  }

  const supabase = tryCreateSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Identity service unavailable" }, { status: 503 });
  const { data, error } = await supabase.from("users").select("id,email").eq("email", email).maybeSingle();
  if (error || !data?.id) return NextResponse.json({ error: "Staff identity is not provisioned" }, { status: 403 });

  const value = createE2eSessionValue(email);
  if (!value) return NextResponse.json({ error: "E2E authentication is unavailable" }, { status: 503 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(E2E_SESSION_COOKIE, value, e2eSessionCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(E2E_SESSION_COOKIE, "", { ...e2eSessionCookieOptions(), maxAge: 0 });
  return response;
}
