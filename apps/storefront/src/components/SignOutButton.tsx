"use client";

import { Button } from "@universal-music-store/ui";
import { resetPostHogClient } from "@universal-music-store/sdk";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        resetPostHogClient();
        void signOut({ callbackUrl: "/" });
      }}
      className="mt-4 inline-flex min-h-11 items-center px-6 py-2.5 text-sm font-medium text-on-surface-variant"
    >
      Sign out
    </Button>
  );
}
