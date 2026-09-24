import { NextRequest, NextResponse } from "next/server";
import { completeAdminOAuth } from "@/lib/auth";
import { requestFacingOrigin } from "@/lib/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isAllowedBrowserOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return false;
    return (
      url.origin === "https://universalmusic.vercel.app" ||
      url.hostname.endsWith("-justinedevs-projects.vercel.app") ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const requestedOrigin = request.nextUrl.searchParams.get("origin");
  const origin = requestedOrigin && isAllowedBrowserOrigin(requestedOrigin)
    ? new URL(requestedOrigin).origin
    : requestFacingOrigin(request);
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=OAuthCallback", origin));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/sign-in?error=OAuthCallback", origin));
  const { data } = await supabase.auth.getUser();
  const googleIdentity = data.user?.identities?.find((identity) => identity.provider === "google");
  const adminDestination = destination === "/admin" || destination.startsWith("/admin/");
  const session = adminDestination && data.user
    ? await completeAdminOAuth(data.user, googleIdentity?.id)
    : data.user;
  if (!session) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/sign-in?error=AccessDenied", origin));
  }
  return NextResponse.redirect(new URL(destination, origin));
}
