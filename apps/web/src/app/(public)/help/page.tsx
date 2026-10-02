import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import {
  StorefrontPageFrame,
  StorefrontPageHeader,
} from "@/components/storefront/StorefrontPagePrimitives";

export const metadata: Metadata = buildPageMetadata({
  title: "Help center",
  description:
    "Support links for orders, shipping, returns, accessibility, privacy, and contact.",
  path: "/help",
  keywords: [...SEO_KEYWORDS.help],
});

const cards: { title: string; description: string; href: string }[] = [
  {
    title: "FAQ",
    description: "Returns, exchanges, sizing, and shipping basics.",
    href: "/faq",
  },
  {
    title: "Track order",
    description: "Look up status with your order reference.",
    href: "/track",
  },
  {
    title: "Shipping",
    description: "Couriers, timelines, and Cavite pickup context.",
    href: "/shipping",
  },
  {
    title: "Returns & exchanges",
    description: "Eligibility, timelines, and how to request.",
    href: "/returns",
  },
  {
    title: "Privacy",
    description: "How we handle personal data (PDPA-aligned).",
    href: "/privacy",
  },
  {
    title: "Cookies",
    description: "What we store in your browser and why.",
    href: "/cookies",
  },
  {
    title: "Accessibility",
    description: "Inclusive browsing and known limitations.",
    href: "/accessibility",
  },
  {
    title: "Contact",
    description: "Reach the team directly.",
    href: "/contact",
  },
  {
    title: "Local preferences",
    description:
      "Device-local language, layout, measurement, and motion settings.",
    href: "/preferences",
  },
];

export default function HelpPage() {
  return (
    <StorefrontPageFrame width="standard">
      <StorefrontPageHeader
        title="Help center"
        description="Find quick answers for orders, delivery, returns, account access, and storefront preferences."
      />
      <ul className="mt-8 grid list-none grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="block h-full rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm transition-colors hover:border-primary/40 hover:bg-surface-container-low"
            >
              <h2 className="font-headline text-lg font-bold text-primary">
                {c.title}
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {c.description}
              </p>
              <span className="mt-5 inline-flex text-sm font-semibold text-primary">
                Open{" "}
                <span aria-hidden="true" className="ml-1">
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </StorefrontPageFrame>
  );
}
