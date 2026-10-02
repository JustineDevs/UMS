"use client";

import { signIn } from "@/lib/auth-actions";
import { StorefrontAuthCard } from "@/components/StorefrontAuthCard";

export function WatermelonSignIn({
  callbackUrl,
  reauth,
}: {
  callbackUrl: string;
  reauth: boolean;
}) {
  const handleGoogleLogin = async () => {
    try {
      await signIn(
        "google",
        { callbackUrl },
        reauth ? { prompt: "login" } : undefined,
      );
    } catch {
      window.location.assign(
        `/login?callbackUrl=${encodeURIComponent(callbackUrl)}&error=ClientConfiguration`,
      );
    }
  };

  return (
    <StorefrontAuthCard
      heading="Login"
      subheading="Log in to continue to your account."
      googleLabel="Continue with Google"
      onGoogleLogin={() => void handleGoogleLogin()}
      footerPrompt="Don't have an account yet?"
      footerLabel="Sign up"
      footerHref={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      googleTestId="sign-in-google"
    />
  );
}
