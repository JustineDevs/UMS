import Link from "next/link";
import type { Metadata } from "next";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { PolicyMeta } from "@/lib/policy-content";
import {
  StorefrontPageFrame,
  StorefrontPageHeader,
} from "@/components/storefront/StorefrontPagePrimitives";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms",
  description:
    "Store terms, payment notes, order acceptance, and consumer policy summary.",
  path: "/terms",
  keywords: [...SEO_KEYWORDS.policies],
});

export default function TermsPage() {
  return (
    <StorefrontPageFrame
      width="narrow"
      className="font-body leading-relaxed text-on-surface-variant"
    >
      <StorefrontPageHeader
        title="Terms"
        description="Store terms, payment notes, order acceptance, and consumer policy summary."
      />
      <PolicyMeta policy="Terms" />
      <div className="mt-8 space-y-6">
        <p>
          By using this storefront you agree to purchase goods from{" "}
          <strong>Universal Music Store</strong> under the prices, descriptions,
          and policies shown at checkout. Product images and measurements are
          illustrative; minor variance may occur between batches.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Payment methods supported include those shown at checkout (e.g.
            card, e-wallet, COD where offered).
          </li>
          <li>
            Orders are accepted when payment or valid payment intent is
            confirmed, subject to stock availability.
          </li>
          <li>
            Risk of loss passes to the carrier upon handoff unless otherwise
            required by law.
          </li>
        </ul>
        <p>
          We disclose refund and exchange procedures on our{" "}
          <Link href="/returns" className="text-primary font-medium underline">
            Returns
          </Link>{" "}
          page. Philippine consumer rules may provide additional remedies for
          defective or misdescribed goods.
        </p>
        <p>
          Our{" "}
          <Link href="/privacy" className="text-primary font-medium underline">
            Privacy policy
          </Link>{" "}
          and{" "}
          <Link href="/cookies" className="text-primary font-medium underline">
            Cookie notice
          </Link>{" "}
          describe data practices.
        </p>
        <p>
          <Link href="/shop" className="text-primary font-medium underline">
            Continue shopping
          </Link>
        </p>
      </div>
    </StorefrontPageFrame>
  );
}
