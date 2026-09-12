import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { fetchProductSlugsForSitemap } from "@/lib/catalog-fetch";

export const metadata: Metadata = buildPageMetadata({
  title: "Site map",
  description: "Structured list of main storefront pages.",
  path: "/sitemap",
  keywords: [...SEO_KEYWORDS.sitewide],
  noindex: true,
});

const links: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/collections", label: "Collections" },
  { href: "/search", label: "Search" },
  { href: "/checkout", label: "Checkout / bag" },
  { href: "/wishlist", label: "Saved items" },
  { href: "/track", label: "Track order" },
  { href: "/account", label: "My account" },
  { href: "/sign-in", label: "Sign in" },
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
  { href: "/warranty", label: "Warranty" },
];

export default async function SitemapPage() {
  const productSlugs = await fetchProductSlugsForSitemap(1000);
  const productLinks = productSlugs.map((slug) => ({ href: `/shop/${encodeURIComponent(slug)}`, label: slug }));
  return (
    <main className="storefront-page-shell max-w-2xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Site map
      </h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        Structured list of main storefront pages.
      </p>
      <ul className="mt-8 grid list-none grid-cols-1 gap-2 sm:grid-cols-2">
        {[...links, ...productLinks].map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-primary underline hover:opacity-80"
            >
              {l.label}
            </Link>
            <span className="ml-2 text-xs text-on-surface-variant">
              {l.href}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
