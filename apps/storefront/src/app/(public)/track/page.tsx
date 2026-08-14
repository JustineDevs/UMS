import type { Metadata } from "next";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import { redirect } from "next/navigation";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildPageMetadata({
  title: "Track order",
  description: "Enter your order number and tracking code to view delivery status.",
  path: "/track",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

type Props = {
  searchParams: Promise<{ orderId?: string; t?: string }>;
};

function resolveOrderAndToken(
  orderIdRaw: string | undefined,
  tRaw: string | undefined,
): {
  orderId: string;
  token: string;
} | null {
  const trimmed = orderIdRaw?.trim() ?? "";
  let orderId = trimmed;
  let token = tRaw?.trim() ?? "";

  try {
    const base =
      typeof process.env.NEXT_PUBLIC_SITE_URL === "string" &&
      process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL
        : DEFAULT_PUBLIC_SITE_ORIGIN;
    const u = trimmed.startsWith("http")
      ? new URL(trimmed)
      : new URL(trimmed, base);
    const m = u.pathname.match(/\/track\/([^/]+)/);
    const qp = u.searchParams.get("t");
    if (m && qp) {
      orderId = decodeURIComponent(m[1]);
      token = qp;
    }
  } catch {
    /* plain order reference, not a URL */
  }

  if (!orderId || !token) return null;
  return { orderId, token };
}

export default async function TrackRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const resolved = resolveOrderAndToken(sp.orderId, sp.t);
  if (resolved) {
    redirect(
      `/track/${encodeURIComponent(resolved.orderId)}?t=${encodeURIComponent(resolved.token)}`,
    );
  }

  return (
    <main className="storefront-page-shell max-w-2xl">
      <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
        Track Order
      </h1>
      <p className="font-body text-on-surface-variant mb-12">
        Enter your order number and tracking code from your confirmation email,
        or paste the full tracking link into the first field.
      </p>
      <form action="/track" method="GET" className="space-y-4">
        <div>
          <label
            htmlFor="orderId"
            className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary"
          >
            Order number or full tracking link
          </label>
          <input
            id="orderId"
            type="text"
            name="orderId"
            placeholder="ORD-… or https://…/track/…?t=…"
            required
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 font-body text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label
            htmlFor="t"
            className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary"
          >
            Tracking code (if not using a full link)
          </label>
          <input
            id="t"
            type="text"
            name="t"
            placeholder="Long code from your email"
            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 font-body text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-on-primary px-6 py-3 rounded font-medium hover:opacity-90"
        >
          Track
        </button>
      </form>
    </main>
  );
}
