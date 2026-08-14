import type { Metadata } from "next";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { NextAuthSessionProvider } from "@/components/NextAuthSessionProvider";
import { AdminMutationRequestGuard } from "@/components/AdminMutationRequestGuard";
import { LenisProvider } from "@/components/LenisProvider";
import { VercelWebAnalytics } from "@/components/VercelWebAnalytics";
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

const materialSymbols = localFont({
  src: "./fonts/material-symbols-outlined.ttf",
  variable: "--font-material-symbols",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Universal Music Store Admin",
  description: "Universal Music Store back office for orders, inventory, POS, CRM, and content.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${inter.variable} ${materialSymbols.variable}`}
    >
      <body className="bg-surface font-body text-on-surface antialiased">
        <NextAuthSessionProvider>
          <AdminMutationRequestGuard />
          <LenisProvider>{children}</LenisProvider>
        </NextAuthSessionProvider>
        <VercelWebAnalytics />
      </body>
    </html>
  );
}
