import { NextRequest, NextResponse } from "next/server";
import { completeAdminOAuth } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=OAuthCallback", request.url));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/sign-in?error=OAuthCallback", request.url));
  const { data } = await supabase.auth.getUser();
  const googleIdentity = data.user?.identities?.find((identity) => identity.provider === "google");
  const session = data.user ? await completeAdminOAuth(data.user, googleIdentity?.id) : null;
  if (!session) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/sign-in?error=AccessDenied", request.url));
  }
  return NextResponse.redirect(new URL(destination, request.url));
}
