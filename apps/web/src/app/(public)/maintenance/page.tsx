import type { Metadata } from "next";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Maintenance",
  description: "Temporary maintenance notice.",
  path: "/maintenance",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function MaintenancePage() {
  return (
    <main className="storefront-page-shell flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-headline text-2xl font-bold text-primary sm:text-3xl">
        We will be right back
      </h1>
      <p className="mt-4 max-w-md text-sm text-on-surface-variant leading-relaxed">
        The shop is temporarily unavailable while we perform updates. Please try
        again in a few minutes.
      </p>
    </main>
  );
}
