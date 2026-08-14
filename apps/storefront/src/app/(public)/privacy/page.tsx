import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy policy",
  description:
    "Universal Music Store privacy policy. How we collect, use, and protect your data. PDPA and GDPR aligned.",
  path: "/privacy",
  keywords: [...SEO_KEYWORDS.policies],
});

export default function PrivacyPage() {
  return (
    <main className="storefront-page-shell max-w-3xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Privacy policy
      </h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        Last updated: {new Date().getFullYear()}
      </p>
      <div className="mt-8 space-y-6 font-body text-sm leading-relaxed text-on-surface-variant">
        <section>
          <h2 className="text-xl font-bold">Who we are</h2>
          <p>
            This policy describes how <strong>Universal Music Store</strong>{" "}
            (&quot;we&quot;) collects, uses, and protects personal information
            when you use our website and services. We align practices with the{" "}
            <strong>Philippines Data Privacy Act (PDPA)</strong> and respect
            GDPR expectations where EU visitors shop with us.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold">What we collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Account &amp; contact:</strong> name, email, and profile
              data from Google OAuth when you sign in.
            </li>
            <li>
              <strong>Orders:</strong> shipping address, line items, payment
              status from our processor (we do not store full card numbers on
              our servers).
            </li>
            <li>
              <strong>Technical:</strong> browser type, device identifiers, and
              security logs needed to operate and protect the service.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-bold">Why we use data</h2>
          <p>
            To fulfill orders, prevent fraud, improve the storefront, meet legal
            obligations, and communicate about your purchases. We do not sell
            your personal information.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold">Sharing</h2>
          <p>
            We share data with payment, hosting, email, and logistics providers
            strictly as needed to complete your transaction. Each processor is
            required to protect data under contract and applicable law.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold">Retention</h2>
          <p>
            We keep order and accounting records as long as required for tax,
            disputes, and legitimate business needs. Marketing preferences can
            be adjusted when we offer subscribed communications.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold">Your rights</h2>
          <p>
            You may request access, correction, or deletion where applicable.
            Contact us through <Link href="/contact">Contact</Link> with the
            subject line “Privacy request” and enough detail to verify your
            identity.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold">Cookies</h2>
          <p>
            See the <Link href="/cookies">Cookies</Link> page for categories we
            use and your choices.
          </p>
        </section>
      </div>
    </main>
  );
}
