import type { Metadata } from "next";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildPageMetadata({
  title: "Track order",
  description: "Open a secure tracking link to view delivery status.",
  path: "/track",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function TrackRedirectPage() {
  return (
    <main className="storefront-page-shell max-w-2xl">
      <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
        Track Order
      </h1>
      <p className="font-body text-on-surface-variant mb-12">
        Paste the secure tracking link from your confirmation email. Raw order
        numbers and separate tracking codes are not accepted.
      </p>
      <form action="/api/tracking-link/resolve" method="POST" className="space-y-4">
        <div>
          <label
            htmlFor="orderId"
            className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary"
          >
            Full secure tracking link
          </label>
          <input
            id="orderId"
            type="text"
            name="trackingUrl"
            placeholder="https://…/track/cap_…"
            required
            className="min-h-11 w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 font-body text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
            className="min-h-11 bg-primary text-on-primary px-6 py-3 rounded font-medium hover:opacity-90"
        >
          Track
        </button>
      </form>
    </main>
  );
}
