import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { fetchProductSlugsForSitemap } from "@/lib/catalog-fetch";
import {
  StorefrontCard,
  StorefrontPageFrame,
  StorefrontPageHeader,
} from "@/components/storefront/StorefrontPagePrimitives";

export const metadata: Metadata = buildPageMetadata({
  title: "Site map",
  description: "Structured list of main storefront pages.",
  path: "/site-map",
  keywords: [...SEO_KEYWORDS.sitewide],
  noindex: true,
});

const links: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/search", label: "Search" },
  { href: "/checkout", label: "Checkout / bag" },
  { href: "/wishlist", label: "Saved items" },
  { href: "/track", label: "Track order" },
  { href: "/account/profile", label: "My account" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
  { href: "/help", label: "Help center" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/shipping", label: "Shipping" },
  { href: "/returns", label: "Returns & exchanges" },
  { href: "/warranty", label: "Warranty" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/preferences", label: "Local preferences" },
  { href: "/blog", label: "Blog" },
  { href: "/variant-guide", label: "Variant guide" },
];

export default async function SitemapPage() {
  const productSlugs = await fetchProductSlugsForSitemap(1000);
  const productLinks = productSlugs.map((slug) => ({
    href: `/shop/${encodeURIComponent(slug)}`,
    label: slug,
  }));
  return (
    <StorefrontPageFrame width="standard">
      <StorefrontPageHeader
        title="Site map"
        description="Browse the storefront by purpose, then open the product catalog when you know what you want."
      />
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <StorefrontCard as="div" className="p-5 sm:p-6">
          <h2 className="font-headline text-lg font-bold text-primary">
            Storefront pages
          </h2>
          <ul className="mt-4 space-y-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm font-medium text-primary underline underline-offset-4"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </StorefrontCard>
        <StorefrontCard as="div" className="p-5 sm:p-6">
          <h2 className="font-headline text-lg font-bold text-primary">
            Products
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Browse the current catalog by product page.
          </p>
          <ul className="mt-4 space-y-3">
            {productLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm font-medium text-primary underline underline-offset-4"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </StorefrontCard>
      </div>
    </StorefrontPageFrame>
  );
}
