"use client";

import { Auth04 } from "@universal-music-store/ui";
import { signIn } from "@/lib/auth-client";

export function WatermelonRegister({ callbackUrl }: { callbackUrl: string }) {
  return (
    <Auth04
      brandName="Universal Music Store"
      socialOnly
      showFooter={false}
      heading="Create your account"
      subheading="Join Universal Music Store and keep your orders in one place."
      googleLabel="Continue with Google"
      footerPrompt="Already have an account?"
      footerActionLabel="Sign in"
      onGoogleLogin={(_remember) => void signIn("google", { callbackUrl })}
      onFooterAction={() => { window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`; }}
      onForgotPassword={() => { window.location.href = "/contact?topic=account"; }}
      onLogin={() => { window.location.href = "/contact?topic=account"; }}
      footerLinks={[
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Support", href: "/contact" },
      ]}
    />
  );
}
