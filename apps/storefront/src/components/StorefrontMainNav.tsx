"use client";

import type { CmsNavLink, CmsNavigationPayload } from "@universal-music-store/platform-data";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isKnownUnavailableExternalImage,
  shouldUnoptimizeImage,
} from "@/lib/image-helpers";

type FlatItem = { href: string; label: string; badge?: string };

const DEFAULT_ITEMS: FlatItem[] = [
  { href: "/shop", label: "Shop" },
  { href: "/collections", label: "Collections" },
  { href: "/", label: "About" },
];

const ICON_MAP: Record<string, string> = {
  star: "star",
  sale: "sell",
  new_releases: "new_releases",
  local_offer: "local_offer",
};

function linkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function flatForMobile(nav: CmsNavigationPayload | undefined): FlatItem[] {
  if (!nav) return [];
  const src =
    nav.headerLinksMobile.length > 0 ? nav.headerLinksMobile : nav.headerLinks;
  return src.map((l) => ({
    href: l.href,
    label: l.label,
    badge: l.badge,
  }));
}

function NavBadge({ text }: { text: string }) {
  return (
    <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
      {text}
    </span>
  );
}

function MegaTrigger({
  link,
  pathname,
}: {
  link: CmsNavLink;
  pathname: string;
}) {
  const active = linkActive(pathname, link.href);
  const hasMega = (link.children?.length ?? 0) > 0 || link.featured;

  if (!hasMega) {
    return (
      <Link
        href={link.href}
        data-testid="nav-link"
        className={
          active
            ? "shrink-0 border-b-2 border-primary pb-0.5 text-[11px] font-semibold text-primary transition-colors xs:text-xs sm:text-sm"
            : "shrink-0 text-[11px] font-medium text-on-surface-variant transition-colors hover:text-primary xs:text-xs sm:text-sm"
        }
      >
        {link.iconKey && ICON_MAP[link.iconKey] ? (
          <span
            className="material-symbols-outlined mr-0.5 align-middle text-base leading-none"
            aria-hidden
          >
            {ICON_MAP[link.iconKey]}
          </span>
        ) : null}
        {link.label}
        {link.badge ? <NavBadge text={link.badge} /> : null}
      </Link>
    );
  }

  return (
    <div className="group relative shrink-0">
      <Link
        href={link.href}
        className={
          active
            ? "inline-flex items-center border-b-2 border-primary pb-0.5 text-[11px] font-semibold text-primary transition-colors xs:text-xs sm:text-sm"
            : "inline-flex items-center text-[11px] font-medium text-on-surface-variant transition-colors hover:text-primary xs:text-xs sm:text-sm"
        }
      >
        {link.iconKey && ICON_MAP[link.iconKey] ? (
          <span
            className="material-symbols-outlined mr-0.5 align-middle text-base leading-none"
            aria-hidden
          >
            {ICON_MAP[link.iconKey]}
          </span>
        ) : null}
        {link.label}
        {link.badge ? <NavBadge text={link.badge} /> : null}
        <span className="material-symbols-outlined ml-0.5 text-sm opacity-60" aria-hidden>
          expand_more
        </span>
      </Link>
      <div
        className="pointer-events-none invisible absolute left-1/2 top-full z-40 w-[min(100vw-2rem,28rem)] -translate-x-1/2 pt-2 opacity-0 transition-all group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100"
        role="region"
        aria-label={`${link.label} submenu`}
      >
        <div className="rounded-xl border border-outline-variant/30 bg-white p-4 shadow-xl">
          <div className="flex gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              {link.children?.map((c) => (
                <Link
                  key={`${c.href}-${c.label}`}
                  href={c.href}
                  className="block rounded-md px-2 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                >
                  {c.label}
                  {c.badge ? <NavBadge text={c.badge} /> : null}
                </Link>
              ))}
            </div>
            {link.featured?.href ? (
              <Link
                href={link.featured.href}
                className="hidden w-40 shrink-0 sm:block"
              >
                {link.featured.imageUrl ? (
                  <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-surface-container-low">
                    {isKnownUnavailableExternalImage(link.featured.imageUrl) ? (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-container-high via-surface-container-low to-surface-container-high text-[10px] font-medium text-on-surface-variant">
                        Image unavailable
                      </div>
                    ) : (
                      <Image
                        src={link.featured.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="160px"
                        unoptimized={shouldUnoptimizeImage(link.featured.imageUrl)}
                      />
                    )}
                  </div>
                ) : null}
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {link.featured.label}
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StorefrontMainNav({
  navigation,
}: {
  navigation?: CmsNavigationPayload;
}) {
  const pathname = usePathname() ?? "";

  const mobileItems =
    navigation && navigation.headerLinks.length > 0
      ? flatForMobile(navigation)
      : DEFAULT_ITEMS;

  const desktopLinks =
    navigation && navigation.headerLinks.length > 0
      ? navigation.headerLinks
      : null;

  return (
    <>
      <div className="flex min-w-0 max-w-[min(100%,14rem)] flex-1 items-center justify-center gap-3 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden">
        {mobileItems.map((item) => {
          const active = linkActive(pathname, item.href);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              data-testid={item.href === "/shop" ? "nav-shop" : undefined}
              className={
                active
                  ? "shrink-0 border-b-2 border-primary pb-0.5 text-[11px] font-semibold text-primary xs:text-xs"
                  : "shrink-0 text-[11px] font-medium text-on-surface-variant hover:text-primary xs:text-xs"
              }
            >
              {item.label}
              {item.badge ? <NavBadge text={item.badge} /> : null}
            </Link>
          );
        })}
      </div>

      <div className="hidden min-w-0 flex-1 items-center justify-center gap-6 overflow-visible sm:flex md:gap-10 lg:gap-12">
        {desktopLinks
          ? desktopLinks.map((link) => (
              <MegaTrigger key={`${link.href}-${link.label}`} link={link} pathname={pathname} />
            ))
          : DEFAULT_ITEMS.map((item) => {
              const active = linkActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={item.href === "/shop" ? "nav-shop" : undefined}
                  className={
                    active
                      ? "shrink-0 border-b-2 border-primary pb-0.5 text-sm font-semibold text-primary"
                      : "shrink-0 text-sm font-medium text-on-surface-variant hover:text-primary"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
      </div>
    </>
  );
}
