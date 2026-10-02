import Link from "next/link";
import type { Metadata } from "next";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { PolicyMeta } from "@/lib/policy-content";
import {
  StorefrontPageFrame,
  StorefrontPageHeader,
} from "@/components/storefront/StorefrontPagePrimitives";

export const metadata: Metadata = buildPageMetadata({
  title: "Returns & exchanges",
  description:
    "Return and exchange policy for defective, damaged, or misdescribed items.",
  path: "/returns",
  keywords: [...SEO_KEYWORDS.policies],
});

export default function ReturnsPage() {
  return (
    <StorefrontPageFrame
      width="narrow"
      className="font-body leading-relaxed text-on-surface-variant"
    >
      <StorefrontPageHeader
        title="Returns & exchanges"
        description="Eligibility, timelines, and how to request an exchange, replacement, or refund."
      />
      <PolicyMeta policy="Returns & exchanges" />
      <div className="mt-8 space-y-6">
        <p>
          We accept returns or exchanges for defective, damaged, incorrectly
          delivered, or materially different items. For eligible non-defective
          items, we may allow <strong>exchange within 7 days</strong> of
          receipt, provided the item is unused, unwashed, unaltered, with
          original tags, packaging, and proof of purchase.
        </p>
        <h2 className="font-headline text-xl font-bold text-primary pt-4">
          Eligible cases
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Wrong item, size, or color shipped.</li>
          <li>Damaged goods or manufacturing defect.</li>
          <li>Item substantially different from the listing.</li>
          <li>
            Parcel lost in transit or undelivered after carrier investigation.
          </li>
        </ul>
        <h2 className="font-headline text-xl font-bold text-primary pt-4">
          Non-returnable
        </h2>
        <p>
          Unless defective or incorrectly shipped: used, washed, or altered
          items; items without tags or proof of purchase; final-sale items if
          marked as such; hygiene-sensitive categories (underwear, socks,
          swimwear bottoms, etc.).
        </p>
        <h2 className="font-headline text-xl font-bold text-primary pt-4">
          Refund timeline (after approval)
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Review:</strong> We acknowledge most requests within 1 to 2
            business days once we have order ID and photos where needed.
          </li>
          <li>
            <strong>Return ship:</strong> If you must send goods back, use the
            instructions we send. Refunds are not finalized until we inspect
            eligible items (when inspection applies).
          </li>
          <li>
            <strong>Refund to original payment:</strong> Typically 5 to 14
            business days after we approve and process, depending on your bank
            or card network.
          </li>
          <li>
            <strong>Store credit:</strong> If offered and accepted, credit is
            usually applied within 1 to 3 business days after approval.
          </li>
        </ul>

        <h2 className="font-headline text-xl font-bold text-primary pt-4">
          How to request
        </h2>
        <p>
          Contact support within <strong>7 days of delivery</strong> with order
          number, reason, clear photos or video, and preferred resolution
          (exchange, replacement, store credit, or refund). We review complete
          submissions within <strong>2 to 5 business days</strong>.
        </p>
        <p>
          <strong>Seller fault:</strong> replacement, exchange, or refund as
          approved. No remedy cost passed to you for valid defect claims.{" "}
          <strong>Customer size change:</strong> exchange may be offered; return
          shipping may be customer-paid unless we subsidize as a courtesy.
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/shipping" className="text-primary font-medium underline">
            Shipping information
          </Link>
          <Link href="/warranty" className="text-primary font-medium underline">
            Warranty
          </Link>
        </p>
      </div>
    </StorefrontPageFrame>
  );
}
