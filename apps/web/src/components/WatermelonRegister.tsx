"use client";

import { signIn } from "@/lib/auth-actions";
import { StorefrontAuthCard } from "@/components/StorefrontAuthCard";

export function WatermelonRegister({ callbackUrl }: { callbackUrl: string }) {
  const handleGoogleLogin = async () => {
    try {
      await signIn("google", { callbackUrl });
    } catch {
      window.location.assign(
        `/register?callbackUrl=${encodeURIComponent(callbackUrl)}&error=ClientConfiguration`,
      );
    }
  };

  return (
    <StorefrontAuthCard
      heading="Create your account"
      subheading="Join Universal Music Store and keep your orders in one place."
      googleLabel="Continue with Google"
      onGoogleLogin={() => void handleGoogleLogin()}
      footerPrompt="Already have an account?"
      footerLabel="Log in"
      footerHref={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
    />
  );
}
