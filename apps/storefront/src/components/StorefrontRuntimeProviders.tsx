"use client";

import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { BotIdClient } from "botid/client";
import { CartAbandonmentBeacon } from "@/components/CartAbandonmentBeacon";
import { CartSyncOnSignIn } from "@/components/CartSyncOnSignIn";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { NextAuthSessionProvider } from "@/components/NextAuthSessionProvider";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { PostHogAnalytics } from "@/components/PostHogAnalytics";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { StorefrontPreferenceSync } from "@/components/StorefrontPreferenceSync";
import { WishlistSyncOnLogin } from "@/components/WishlistSyncOnLogin";
import { MedusaCartProvider } from "@/context/MedusaCartContext";

const botIdDisabledForLocalAuthBypass =
  process.env.AUTH_DISABLED === "true" || process.env.AUTH_DISABLE === "true";

export function StorefrontRuntimeProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider>
      <MedusaCartProvider>
        <PostHogAnalytics />
        {!botIdDisabledForLocalAuthBypass ? (
          <BotIdClient
            protect={[
              { path: "/api/checkout", method: "POST" },
              { path: "/api/checkout/cod-cart-payload", method: "POST" },
              { path: "/api/checkout/cod-place-order", method: "POST" },
              { path: "/api/checkout/complete-medusa-cart", method: "POST" },
              { path: "/api/checkout/apply-promo", method: "POST" },
              { path: "/api/checkout/verify-stock", method: "POST" },
              { path: "/api/checkout/upload-payment-receipt", method: "POST" },
              { path: "/api/account/profile", method: "PATCH" },
              { path: "/api/account/orders/*/cancel", method: "POST" },
              { path: "/api/reviews", method: "POST" },
              { path: "/api/cart/medusa-bind", method: "POST" },
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
        <Suspense fallback={null}>
          <OnboardingGuard>
            <SmoothScrollProvider>{children}</SmoothScrollProvider>
          </OnboardingGuard>
        </Suspense>
        <CookieConsentBanner />
        {process.env.VERCEL === "1" ? <Analytics /> : null}
      </MedusaCartProvider>
    </NextAuthSessionProvider>
  );
}
