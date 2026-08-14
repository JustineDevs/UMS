import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Cookies",
  description: "Cookie notice explaining essential, functional, and analytics storage.",
  path: "/cookies",
  keywords: [...SEO_KEYWORDS.policies],
});

export default function CookiesPage() {
  return (
    <main className="storefront-page-shell max-w-3xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Cookie notice
      </h1>
      <div className="mt-8 space-y-6 font-body text-sm leading-relaxed text-on-surface-variant">
        <p>
          We use cookies and similar storage to operate this storefront
          securely, remember your session when you sign in, and keep your cart
          usable across pages.
        </p>
        <section>
          <h2 className="font-headline text-lg font-bold text-primary">
            Essential
          </h2>
          <p>
            Required for security (e.g. CSRF/session tokens with NextAuth),
            checkout flow continuity, and load balancing. These cannot be
            disabled without breaking core features.
          </p>
        </section>
        <section>
          <h2 className="font-headline text-lg font-bold text-primary">
            Functional
          </h2>
          <p>
            Preferences such as saved-item lists may be stored locally in your
            browser (<code>localStorage</code>) so the UI can show favorites
            without cloud sync until you sign in.
          </p>
        </section>
        <section>
          <h2 className="font-headline text-lg font-bold text-primary">
            Analytics &amp; marketing
          </h2>
          <p>
            If we enable measurement or advertising pixels in the future, we
            will list them here and provide opt-out links where required.
            Currently, only operational cookies described above are used.
          </p>
        </section>
        <p>
          Questions? Read our <Link href="/privacy">Privacy policy</Link> or{" "}
          <Link href="/contact">contact us</Link>.
        </p>
      </div>
    </main>
  );
}
