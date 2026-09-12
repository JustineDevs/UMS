import type {
  CmsFooterColumn,
  CmsNavLink,
  CmsSocialLink,
  StorefrontSocialLink,
} from "@universal-music-store/platform-data";
import Image from "next/image";
import Link from "next/link";

export function StorefrontFooter({
  cmsFooterColumns,
  cmsFooterBottomLinks,
  cmsSocialLinks,
  publicSocialLinks,
}: {
  cmsFooterColumns?: CmsFooterColumn[];
  cmsFooterBottomLinks?: CmsNavLink[];
  cmsSocialLinks?: CmsSocialLink[];
  /** From CMS / env (resolved on server). */
  publicSocialLinks?: StorefrontSocialLink[];
}) {
  const socialLinks = [...(cmsSocialLinks ?? []), ...(publicSocialLinks ?? [])].filter(
    (link, index, links) => links.findIndex((candidate) => candidate.href === link.href) === index,
  );

  return (
    <footer
      className="w-full border-t border-slate-100 bg-slate-50 px-[clamp(0.75rem,4vw,2rem)] py-16 sm:py-20"
      data-cms-id="storefront-footer"
      data-cms-label="Storefront footer"
    >
      <div
        className="mx-auto grid max-w-7xl grid-cols-2 gap-12 gap-y-14 md:grid-cols-3 md:gap-x-14 lg:grid-cols-6"
        data-cms-id="footer-columns"
        data-cms-label="Footer columns"
      >
        <div data-cms-id="footer-brand" data-cms-label="Brand" className="col-span-2 flex flex-col gap-4 md:col-span-1 lg:col-span-2">
          <Link
            href="/"
            className="relative block aspect-[1536/1024] w-full max-w-xs shrink-0 overflow-visible opacity-90 transition-opacity hover:opacity-100 sm:max-w-sm md:max-w-md lg:max-w-lg"
          >
            <Image
              src="/brand/universal-music-store-logo-landscape.png"
              alt="Universal Music Store"
              width={1536}
              height={1024}
              className="h-full w-full object-contain object-left"
              sizes="(max-width: 768px) 92vw, (max-width: 1280px) 672px, 960px"
              unoptimized
            />
          </Link>
          <p className="font-body text-sm tracking-wide text-slate-500">
            © {new Date().getFullYear()} Universal Music Store.
          </p>
        </div>
        {cmsFooterColumns?.map((col) => (
          <div key={col.title} className="flex min-w-0 flex-col gap-4">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary md:text-base">
              {col.title}
            </h2>
            <nav className="flex flex-col gap-2.5 md:gap-3" aria-label={col.title}>
              {col.links.map((l) => (
                <Link
                  key={`${col.title}-${l.href}-${l.label}`}
                  href={l.href}
                  className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary md:text-base">
            Shop
          </h2>
          <nav
            data-cms-id="footer-shop-links"
            data-cms-label="Shop links"
            className="flex flex-col gap-2.5 md:gap-3"
            aria-label="Shop links"
          >
            <Link
              href="/shop"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              All products
            </Link>
            <Link
              href="/collections"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Collections
            </Link>
            <Link
              href="/search"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Search
            </Link>
            <Link
              href="/wishlist"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Saved items
            </Link>
          </nav>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary md:text-base">
            Support
          </h2>
          <nav
            data-cms-id="footer-support-links"
            data-cms-label="Support links"
            className="flex flex-col gap-2.5 md:gap-3"
            aria-label="Support links"
          >
            <Link
              href="/help"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Help center
            </Link>
            <Link
              href="/faq"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Contact
            </Link>
            <Link
              href="/track"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Track order
            </Link>
          </nav>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary md:text-base">
            Account
          </h2>
          <nav
            className="flex flex-col gap-2.5 md:gap-3"
            aria-label="Account links"
          >
            <Link
              href="/sign-in"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Register
            </Link>
            <Link
              href="/account"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              My account
            </Link>
          </nav>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary md:text-base">
            Policies
          </h2>
          <nav
            className="flex flex-col gap-2.5 md:gap-3"
            aria-label="Legal links"
          >
            <Link
              href="/shipping"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Shipping
            </Link>
            <Link
              href="/returns"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Returns
            </Link>
            <Link
              href="/terms"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Privacy
            </Link>
            <Link
              href="/cookies"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Cookies
            </Link>
            <Link
              href="/accessibility"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Accessibility
            </Link>
            <Link
              href="/preferences"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Local preferences
            </Link>
            <Link
              href="/sitemap"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Site map
            </Link>
          </nav>
        </div>
        <div className="col-span-2 flex min-w-0 flex-col gap-4 lg:col-span-1">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary md:text-base">
            Connect
          </h2>
          <nav data-cms-id="footer-social-links" data-cms-label="Social links" className="flex flex-col gap-2.5 md:gap-3" aria-label="Social">
            {socialLinks.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
              >
                {s.label}
              </a>
            ))}
            <Link
              href="/#join-club"
              className="text-sm leading-snug text-slate-600 hover:text-primary md:text-base"
            >
              Newsletter
            </Link>
          </nav>
        </div>
      </div>
      {cmsFooterBottomLinks && cmsFooterBottomLinks.length > 0 ? (
        <div className="mx-auto mt-12 max-w-7xl border-t border-slate-200 pt-6">
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500 md:justify-start md:text-sm"
            aria-label="Footer secondary"
          >
            {cmsFooterBottomLinks.map((l) => (
              <Link
                key={`${l.href}-${l.label}`}
                href={l.href}
                className="hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </footer>
  );
}
