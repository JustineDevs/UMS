import Link from "next/link";
import type { Metadata } from "next";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { PolicyMeta } from "@/lib/policy-content";
import {
  StorefrontPageFrame,
  StorefrontPageHeader,
} from "@/components/storefront/StorefrontPagePrimitives";

export const metadata: Metadata = buildPageMetadata({
  title: "Shipping",
  description:
    "Shipping timelines, carriers, and delivery notes for Philippines orders.",
  path: "/shipping",
  keywords: [...SEO_KEYWORDS.policies],
});

export default function ShippingPage() {
  return (
    <StorefrontPageFrame
      width="narrow"
      className="font-body leading-relaxed text-on-surface-variant"
    >
      <StorefrontPageHeader
        title="Shipping"
        description="Shipping timelines, carriers, and delivery notes for Philippines orders."
      />
      <PolicyMeta policy="Shipping" />
      <div className="mt-8 space-y-6">
        <p>
          We ship music orders across the Philippines using third-party couriers
          (including <strong>J&amp;T</strong>
          where available) and coordinate <strong>
            pickup from Cavite
          </strong>{" "}
          for wholesale or arranged collections when that option is confirmed on
          your order.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Processing time is quoted on your order confirmation once payment is
            verified.
          </li>
          <li>
            Rural or island addresses may require additional transit days.
          </li>
          <li>
            You will receive tracking information when the carrier accepts the
            parcel.
          </li>
        </ul>
        <p>
          For carrier delays or lost parcels, contact us with your order
          number-we work with the courier’s investigation process.
        </p>
        <p>
          <Link href="/returns" className="text-primary font-medium underline">
            Returns &amp; exchanges
          </Link>
        </p>
      </div>
    </StorefrontPageFrame>
  );
}
