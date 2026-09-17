"use client";

import { Auth04 } from "@universal-music-store/ui";
import { signIn } from "@/lib/auth-client";

export function WatermelonSignIn({ callbackUrl, reauth }: { callbackUrl: string; reauth: boolean }) {
  return (
    <Auth04
      brandName="Universal Music Store"
      socialOnly
      showFooter={false}
      termsHref="/terms"
      privacyHref="/privacy"
      onGoogleLogin={(_remember) => void signIn("google", { callbackUrl }, reauth ? { prompt: "login" } : undefined)}
      onCreateAccount={() => { window.location.href = "/register"; }}
      onForgotPassword={() => { window.location.href = "/contact?topic=account"; }}
      onLogin={() => { window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}&error=password_auth_unavailable`; }}
      footerLinks={[
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Support", href: "/contact" },
      ]}
    />
  );
}
