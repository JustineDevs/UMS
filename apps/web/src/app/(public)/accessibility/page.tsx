import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { PolicyMeta } from "@/lib/policy-content";

export const metadata: Metadata = buildPageMetadata({
  title: "Accessibility",
  description: "Accessibility statement, known limitations, and support contact for barriers.",
  path: "/accessibility",
  keywords: [...SEO_KEYWORDS.policies],
});

export default function AccessibilityPage() {
  return (
    <main className="storefront-page-shell max-w-3xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Accessibility statement
      </h1>
      <PolicyMeta policy="Accessibility statement" />
      <div className="mt-8 space-y-6 font-body text-sm leading-relaxed text-on-surface-variant">
        <p>
          We aim to make <strong>Universal Music Store</strong> (and related storefront
          domains) perceivable, operable, and understandable for people with
          disabilities. We use <strong>WCAG 2.2 Level AA</strong> as our target
          standard. The current tested scope covers keyboard navigation for the
          search combobox, mobile menu, image zoom, and responsive storefront
          and checkout shells; this statement does not claim full conformance.
        </p>
        <section>
          <h2 className="font-headline text-lg font-bold text-primary">
            What we do today
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
            Semantic headings, landmarks, and labels on primary flows (shop,
            product, checkout, account), with a skip-to-main link.
            </li>
            <li>Visible focus states on interactive elements.</li>
            <li>Responsive layouts from narrow phones to wide desktops, covered by the storefront browser matrix.</li>
            <li>
              Reduced-motion: smooth scrolling is disabled when your OS requests
              it.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="font-headline text-lg font-bold text-primary">
            Known limitations
          </h2>
          <p>
            Third-party checkout or embedded widgets may not meet the same
            standard. We track vendor accessibility statements and provide
            alternatives (e.g. contact support) when gaps appear.
          </p>
        </section>
        <section>
          <h2 className="font-headline text-lg font-bold text-primary">
            Feedback
          </h2>
          <p>
            If you encounter a barrier, email us via{" "}
            <Link href="/contact">Contact</Link> with the page URL, device, and
            assistive technology you use. We aim to acknowledge accessibility
            feedback within 5 business days.
          </p>
        </section>
      </div>
    </main>
  );
}
