"use client";

import { Button, cn } from "@universal-music-store/ui";
import { signIn } from "next-auth/react";

type Props = {
  callbackUrl: string;
  label?: string;
  className?: string;
};

export function AdminGoogleSignInButton({
  callbackUrl,
  label = "Continue with Google",
  className,
}: Props) {
  return (
    <Button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      className={cn(
        "mt-8 flex w-full py-4 text-xs font-bold uppercase tracking-widest",
        className,
      )}
    >
      {label}
    </Button>
  );
}
