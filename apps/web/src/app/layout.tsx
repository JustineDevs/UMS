import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import "./globals.css";
import "../admin-globals.css";

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

function resolveSiteUrl(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.toString().replace(/\/$/, "");
  } catch {
    // Fall through to the known-safe canonical origin.
  }
  return DEFAULT_PUBLIC_SITE_ORIGIN;
}

const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

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
    images: [{ url: "/brand/universal-music-store-logo-landscape.png", alt: SITE_NAME }],
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
  // StorefrontPreferenceSync and SmoothScrollProvider intentionally add
  // client-only attributes/classes to <html> after hydration. The explicit
  // suppression below keeps those browser preferences and Lenis state from
  // triggering a root hydration mismatch.
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] min-w-0 overflow-x-hidden bg-surface text-on-surface font-body antialiased supports-[height:100dvh]:min-h-dvh">
        {children}
      </body>
    </html>
  );
}
