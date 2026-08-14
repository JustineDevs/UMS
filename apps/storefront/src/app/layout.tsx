import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import { BotIdClient } from "botid/client";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { StorefrontPreferenceSync } from "@/components/StorefrontPreferenceSync";
import { NextAuthSessionProvider } from "@/components/NextAuthSessionProvider";
import { CartAbandonmentBeacon } from "@/components/CartAbandonmentBeacon";
import { CartSyncOnSignIn } from "@/components/CartSyncOnSignIn";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { PostHogAnalytics } from "@/components/PostHogAnalytics";
import { MedusaCartProvider } from "@/context/MedusaCartContext";
import { VercelWebAnalytics } from "@/components/VercelWebAnalytics";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { RecaptchaScript } from "@/components/RecaptchaScript";
import { WishlistSyncOnLogin } from "@/components/WishlistSyncOnLogin";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_ORIGIN;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  verification: {
    google: "8JhcF2FV7sdKYLW9doHSZnPM3yp3K0LlEusSBI-ZT6g",
  },
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    SITE_NAME,
    "music store Philippines",
    "guitars",
    "bass",
    "drums",
    "amplifiers",
    "instrument accessories",
    "Philippines music gear",
  ],
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_PH",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Music store`,
    description: SITE_DESCRIPTION,
    images: [{ url: "/UVS/UVS_logo_landscape.png", alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/icons/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable}`}>
      <body className="min-h-[100dvh] min-w-0 overflow-x-hidden bg-surface text-on-surface font-body antialiased supports-[height:100dvh]:min-h-dvh">
        <NextAuthSessionProvider>
          <MedusaCartProvider>
            <PostHogAnalytics />
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
            <CartSyncOnSignIn />
            <WishlistSyncOnLogin />
            <StorefrontPreferenceSync />
            <CartAbandonmentBeacon />
            <Suspense fallback={null}>
              <OnboardingGuard>
                <SmoothScrollProvider>{children}</SmoothScrollProvider>
              </OnboardingGuard>
            </Suspense>
          </MedusaCartProvider>
        </NextAuthSessionProvider>
        <RecaptchaScript />
        <VercelWebAnalytics />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
