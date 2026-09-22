"use client";

import dynamic from "next/dynamic";
import { Analytics } from "@vercel/analytics/next";
import { CartAbandonmentBeacon } from "@/components/CartAbandonmentBeacon";
import { CartSyncOnSignIn } from "@/components/CartSyncOnSignIn";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { SupabaseSessionProvider } from "@/components/SupabaseSessionProvider";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { PostHogAnalytics } from "@/components/PostHogAnalytics";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { StorefrontPreferenceSync } from "@/components/StorefrontPreferenceSync";
import { WishlistSyncOnLogin } from "@/components/WishlistSyncOnLogin";
import { CartProvider } from "@/context/CartContext";

const BotIdClient = dynamic(
  () => import("botid/client").then((module) => module.BotIdClient),
  { ssr: false },
);

const botIdDisabledForLocalAuthBypass =
  process.env.NODE_ENV !== "production" ||
  process.env.UVS_E2E_LOCAL === "1" ||
  process.env.AUTH_DISABLED === "true" ||
  process.env.AUTH_DISABLE === "true" ||
  process.env.NEXT_PUBLIC_AUTH_DISABLED === "true" ||
  process.env.NEXT_PUBLIC_AUTH_DISABLE === "true";

export function StorefrontRuntimeProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SupabaseSessionProvider>
      <CartProvider>
        <PostHogAnalytics />
        {!botIdDisabledForLocalAuthBypass ? (
          <BotIdClient
            protect={[
              { path: "/api/checkout", method: "POST" },
              { path: "/api/checkout/cod-cart-payload", method: "POST" },
              { path: "/api/checkout/cod-place-order", method: "POST" },
              { path: "/api/checkout/apply-promo", method: "POST" },
              { path: "/api/checkout/verify-stock", method: "POST" },
              { path: "/api/checkout/upload-payment-receipt", method: "POST" },
              { path: "/api/account/profile", method: "PATCH" },
              { path: "/api/account/orders/*/cancel", method: "POST" },
              { path: "/api/reviews", method: "POST" },
              { path: "/api/cart/bind", method: "POST" },
              { path: "/api/cart/abandonment", method: "POST" },
              { path: "/api/newsletter", method: "POST" },
              { path: "/api/back-in-stock", method: "POST" },
            ]}
          />
        ) : null}
        <CartSyncOnSignIn />
        <WishlistSyncOnLogin disabled={botIdDisabledForLocalAuthBypass} />
        <StorefrontPreferenceSync />
        <CartAbandonmentBeacon />
        <OnboardingGuard>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </OnboardingGuard>
        <CookieConsentBanner />
        {/* Analytics is a client component. Keep its tree identical in SSR and
            hydration; gating it with the server-only VERCEL variable causes a
            production-only mismatch because the browser bundle cannot see it. */}
        <Analytics />
      </CartProvider>
    </SupabaseSessionProvider>
  );
}
