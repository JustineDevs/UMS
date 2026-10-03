"use client";

import { useSession } from "@/lib/auth-client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isExplicitGuestCheckout, requiresStorefrontOnboarding } from "./onboarding-guard-rules";
import { useHydrated } from "@/lib/use-hydrated";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams?.toString() ?? "";
  const guestCheckout = isExplicitGuestCheckout(
    pathname ?? "",
    search,
  );
  const [checked, setChecked] = useState(false);
  const hydrated = useHydrated();
  const [guardError, setGuardError] = useState<string | null>(null);
  const redirecting = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" || !session?.user?.email) {
      if (
        status === "unauthenticated" &&
        pathname === "/checkout" &&
        !guestCheckout &&
        !redirecting.current
      ) {
        redirecting.current = true;
        const next = `${pathname}${search ? `?${search}` : ""}`;
        router.replace(`/login?callbackUrl=${encodeURIComponent(next)}`);
        return;
      }
      setChecked(true);
      return;
    }
    if (guestCheckout) {
      setChecked(true);
      return;
    }
    if (!pathname || !requiresStorefrontOnboarding(pathname)) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    setGuardError(null);
    void (async () => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const profileStatusSignal = AbortSignal.timeout(10_000);
          const response = await fetch("/api/account/profile/status", {
            credentials: "same-origin",
            cache: "no-store",
            signal: profileStatusSignal,
          });
          if (!response.ok) {
            throw new Error(`Profile status request failed (${response.status})`);
          }
          const j = (await response.json()) as { complete?: boolean };
          if (cancelled) return;
          if (j.complete === true) {
            setChecked(true);
            return;
          }
          if (redirecting.current) return;
          redirecting.current = true;
          const next = `${pathname}${search ? `?${search}` : ""}`;
          router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
          return;
        } catch (error: unknown) {
          lastError = error;
          if (cancelled || attempt === 2) break;
          await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      if (!cancelled) {
        setGuardError(
          lastError instanceof Error
            ? lastError.message
            : "Profile status unavailable",
        );
        setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session, pathname, router, search, guestCheckout]);

  if (
    hydrated &&
    status === "authenticated" &&
    !checked &&
    !guestCheckout &&
    pathname &&
    requiresStorefrontOnboarding(pathname)
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center font-body text-sm text-on-surface-variant">
        Loading your profile…
      </div>
    );
  }

  if (
    status === "authenticated" &&
    guardError &&
    pathname &&
    requiresStorefrontOnboarding(pathname)
  ) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center font-body text-sm text-on-surface-variant">
        <p>We could not verify your profile right now.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
