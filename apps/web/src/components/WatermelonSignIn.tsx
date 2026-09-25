"use client";

import { Auth04 } from "@universal-music-store/ui";
import { signIn } from "@/lib/auth-client";

export function WatermelonSignIn({ callbackUrl, reauth }: { callbackUrl: string; reauth: boolean }) {
  const handleGoogleLogin = async () => {
    try {
      await signIn("google", { callbackUrl }, reauth ? { prompt: "login" } : undefined);
    } catch {
      window.location.assign(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}&error=ClientConfiguration`);
    }
  };

  return (
    <main id="main-content" aria-labelledby="sign-in-heading">
      <Auth04
        brandName="Universal Music Store"
        heading="Welcome back"
        socialOnly
        showFooter={false}
        termsHref="/terms"
        privacyHref="/privacy"
        onGoogleLogin={() => void handleGoogleLogin()}
        onCreateAccount={() => { window.location.href = "/register"; }}
        onForgotPassword={() => { window.location.href = "/contact?topic=account"; }}
        onLogin={() => { window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}&error=password_auth_unavailable`; }}
        footerLinks={[
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
          { label: "Support", href: "/contact" },
        ]}
      />
    </main>
  );
}
