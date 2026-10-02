"use client";

import { signOut } from "@/lib/auth-actions";

export function AccountSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
      className="inline-flex min-h-11 items-center rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low focus:outline-2 focus:outline-solid focus:outline-offset-2 focus:outline-primary"
    >
      Sign out
    </button>
  );
}
