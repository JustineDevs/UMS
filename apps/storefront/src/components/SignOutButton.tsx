"use client";

import { Button } from "@apparel-commerce/ui";
import { signOut } from "next-auth/react";
import posthog from "posthog-js";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        posthog.reset();
        void signOut({ callbackUrl: "/" });
      }}
      className="mt-4 inline-block px-6 py-2.5 text-sm font-medium text-on-surface-variant"
    >
      Sign out
    </Button>
  );
}
