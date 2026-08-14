import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@universal-music-store/ui";
import { ContactSupportForm } from "@/components/ContactSupportForm";
import { getCachedPublicSiteMetadata } from "@/lib/public-site-metadata";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { storefrontSocialLinks } from "@universal-music-store/platform-data";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact us",
  description: "Reach Universal Music Store support for orders, exchanges, product questions, and account help.",
  path: "/contact",
  keywords: [...SEO_KEYWORDS.contact],
});

export default async function ContactPage() {
  const meta = await getCachedPublicSiteMetadata();
  const supportEmail =
    meta.supportEmail?.trim() && meta.supportEmail.includes("@")
      ? meta.supportEmail.trim()
      : undefined;
  const supportPhone = meta.supportPhone?.trim() || undefined;
  const socialLinks = storefrontSocialLinks(meta);

  return (
    <main className="storefront-page-shell max-w-6xl">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <section className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
              Contact us
            </h1>
            <p className="max-w-prose text-sm leading-relaxed text-on-surface-variant sm:text-base">
              Orders, exchanges, and product questions for{" "}
              <strong>Universal Music Store</strong>. We handle messages in the order they
              arrive, during business hours in the Philippines, and we reply with the fastest
              available support channel we have on file.
            </p>
          </div>

          <Alert>
            <AlertTitle>What to include</AlertTitle>
            <AlertDescription className="text-sm">
              For order issues, include your order number, the email you used at checkout, and a
              short description of the issue so we can route it faster.
            </AlertDescription>
          </Alert>

          <ContactSupportForm
            supportEmail={supportEmail}
            supportPhone={supportPhone}
          />
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-5">
            <h2 className="font-headline text-lg font-semibold text-primary">Direct support</h2>
            <dl className="mt-4 space-y-4 text-sm text-on-surface-variant">
              <div>
                <dt className="font-medium text-on-surface">Email</dt>
                <dd className="mt-1">
                  {supportEmail ? (
                    <a className="text-primary underline" href={`mailto:${supportEmail}`}>
                      {supportEmail}
                    </a>
                  ) : (
                    "Set in Admin or NEXT_PUBLIC_SUPPORT_EMAIL"
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-on-surface">Phone</dt>
                <dd className="mt-1">
                  {supportPhone ? (
                    <a
                      className="text-primary underline"
                      href={`tel:${supportPhone.replace(/\s/g, "")}`}
                    >
                      {supportPhone}
                    </a>
                  ) : (
                    "Optional"
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-on-surface">Response time</dt>
                <dd className="mt-1">Within 24 business hours</dd>
              </div>
            </dl>
          </div>
          {socialLinks.length > 0 ? (
            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-5">
              <h2 className="font-headline text-lg font-semibold text-primary">Follow the store</h2>
              <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Social media">
                {socialLinks.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          ) : null}

          <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-5">
            <h2 className="font-headline text-lg font-semibold text-primary">Self-service</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                Prefer to find the answer yourself first? Use these pages before submitting a
                request.
              </p>
              <ul className="space-y-2">
                <li>
                  <Link href="/help" className="text-primary underline">
                    Help center
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="text-primary underline">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/shipping" className="text-primary underline">
                    Shipping and delivery
                  </Link>
                </li>
                <li>
                  <Link href="/returns" className="text-primary underline">
                    Returns and exchanges
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <p className="mt-12 text-sm text-on-surface-variant">
        Prefer browsing first? See the{" "}
        <Link href="/help" className="text-primary underline">
          Help center
        </Link>{" "}
        or{" "}
        <Link href="/faq" className="text-primary underline">
          FAQ
        </Link>
        .
      </p>
    </main>
  );
}
