/* eslint-disable @next/next/no-html-link-for-pages -- standalone 404 has no router context. */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export const dynamic = "force-static";

/**
 * Global 404 for unmatched URLs. Route-specific not-found pages under `(public)`
 * still receive the normal public layout; the root fallback must remain isolated
 * from navigation-only client providers during static prerendering.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface px-6 py-16 text-center text-on-surface">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
        HTTP 404
      </p>
      <h1 className="mt-4 font-headline text-3xl font-bold tracking-tight text-primary sm:text-4xl">
        This page could not be found
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-on-surface-variant">
        The page you requested does not exist or is no longer available.
      </p>
      <nav className="mt-8 flex flex-wrap justify-center gap-3" aria-label="Error recovery">
        <a
          href="/"
          className="rounded-md bg-primary px-5 py-3 text-sm font-bold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Back to home
        </a>
        <a
          href="/shop"
          className="rounded-md border border-outline px-5 py-3 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Shop
        </a>
      </nav>
    </main>
  );
}
