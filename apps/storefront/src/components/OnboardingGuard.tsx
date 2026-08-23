"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PROFILE_REQUIRED_PREFIXES = ["/account", "/checkout", "/wishlist"];
const PROFILE_EXEMPT_CHECKOUT_ROUTES = new Set([
  "/checkout/hosted-return",
  "/checkout/stripe-return",
]);

export function isExplicitGuestCheckout(
  pathname: string,
  search: string,
): boolean {
  return pathname === "/checkout" && new URLSearchParams(search).get("guest") === "1";
}

export function requiresStorefrontOnboarding(pathname: string): boolean {
  if (pathname.startsWith("/api")) return false;
  if (pathname.startsWith("/_next")) return false;
  if (pathname.includes(".")) return false;
  if (PROFILE_EXEMPT_CHECKOUT_ROUTES.has(pathname)) return false;
  return PROFILE_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const guestCheckout = isExplicitGuestCheckout(
    pathname ?? "",
    searchParams?.toString() ?? "",
  );
  const [checked, setChecked] = useState(false);
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
        const next = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
        router.replace(`/sign-in?callbackUrl=${encodeURIComponent(next)}`);
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
    void fetch("/api/account/profile/status", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(`Profile status request failed (${r.status})`);
        const j = (await r.json()) as { complete?: boolean };
        if (cancelled) return;
        if (j.complete === true) {
          setChecked(true);
          return;
        }
        if (redirecting.current) return;
        redirecting.current = true;
        const next = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
        router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setGuardError(
            error instanceof Error
              ? error.message
              : "Profile status unavailable",
          );
          setChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, session, pathname, router, searchParams]);

  if (
    status === "authenticated" &&
    !checked &&
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
