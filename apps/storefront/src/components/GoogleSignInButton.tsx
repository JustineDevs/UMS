"use client";

import { Button } from "@universal-music-store/ui";
import { signIn } from "next-auth/react";
import { cn } from "@universal-music-store/ui";

type Props = {
  callbackUrl: string;
  label?: string;
  className?: string;
  promptLogin?: boolean;
};

export function GoogleSignInButton({
  callbackUrl,
  label = "Continue with Google",
  className,
  promptLogin = false,
}: Props) {
  return (
    <Button
      type="button"
      onClick={() => signIn("google", { callbackUrl }, promptLogin ? { prompt: "login" } : undefined)}
      className={cn(
        "mt-8 flex w-full py-4 text-xs font-bold uppercase tracking-widest",
        className,
      )}
    >
      {label}
    </Button>
  );
}
