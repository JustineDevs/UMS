"use client";

import type { CmsNavLink, CmsNavigationPayload } from "@universal-music-store/platform-data";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  isKnownUnavailableExternalImage,
  shouldUnoptimizeImage,
} from "@/lib/image-helpers";

type FlatItem = { href: string; label: string; badge?: string };

const DEFAULT_ITEMS: FlatItem[] = [
  { href: "/shop", label: "Shop" },
  { href: "/collections", label: "Collections" },
  { href: "/about", label: "About" },
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

function scrollToSamePageHash(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (typeof window === "undefined" || !href.includes("#")) return;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
  const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", url.hash);
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
        onClick={(event) => scrollToSamePageHash(event, link.href)}
        data-testid="nav-link"
        className={
          active
            ? "shrink-0 border-b-2 border-primary pb-0.5 text-[11px] font-semibold text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary xs:text-xs sm:text-sm"
            : "shrink-0 text-[11px] font-medium text-on-surface-variant outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary xs:text-xs sm:text-sm"
        }
        aria-current={active ? "page" : undefined}
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
        onClick={(event) => scrollToSamePageHash(event, link.href)}
        className={
          active
            ? "inline-flex items-center border-b-2 border-primary pb-0.5 text-[11px] font-semibold text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary xs:text-xs sm:text-sm"
            : "inline-flex items-center text-[11px] font-medium text-on-surface-variant outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary xs:text-xs sm:text-sm"
        }
        aria-current={active ? "page" : undefined}
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
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-outline-variant/30 bg-white p-4 shadow-xl">
          <div className="flex gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              {link.children?.map((c) => (
                <Link
                  key={`${c.href}-${c.label}`}
                  href={c.href}
                  onClick={(event) => scrollToSamePageHash(event, c.href)}
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
                onClick={(event) => scrollToSamePageHash(event, link.featured?.href ?? "")}
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileWasOpenRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  const mobileItems =
    navigation && navigation.headerLinks.length > 0
      ? flatForMobile(navigation)
      : DEFAULT_ITEMS;

  const desktopLinks =
    navigation && navigation.headerLinks.length > 0
      ? navigation.headerLinks
      : null;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      if (mobileWasOpenRef.current) mobileTriggerRef.current?.focus();
      return;
    }
    mobileWasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !mobileMenuRef.current) return;
      const focusable = Array.from(
        mobileMenuRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <>
      <div className="flex min-w-0 flex-1 justify-center sm:hidden">
        <button
          ref={mobileTriggerRef}
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-site-menu"
          data-hydrated={hydrated ? "true" : "false"}
          data-testid="mobile-menu-trigger"
          className="inline-flex items-center gap-1 rounded px-2 py-2 text-xs font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setMobileOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setMobileOpen(true);
            }
          }}
        >
          Menu
          <span className="material-symbols-outlined text-base" aria-hidden>menu</span>
        </button>
      </div>

      {mobileOpen ? (
        <div
          ref={mobileMenuRef}
          id="mobile-site-menu"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-site-menu-title"
          className="fixed inset-0 z-[60] bg-black/40 sm:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileOpen(false);
          }}
        >
          <div className="ml-auto flex h-full w-[min(21rem,88vw)] flex-col overflow-y-auto overscroll-contain bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <h2 id="mobile-site-menu-title" className="font-headline text-lg font-bold text-primary">Menu</h2>
              <button
                ref={mobileCloseRef}
                type="button"
                aria-label="Close menu"
                className="rounded p-2 text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setMobileOpen(false)}
              >
                <span className="material-symbols-outlined" aria-hidden>close</span>
              </button>
            </div>
            <nav aria-label="Mobile site navigation" className="flex flex-col gap-1 py-5">
              {mobileItems.map((item) => {
                const active = linkActive(pathname, item.href);
                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-testid={item.href === "/shop" ? "nav-shop" : undefined}
                    className="rounded px-3 py-3 text-sm font-semibold text-on-surface-variant outline-none hover:bg-surface-container-low hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={(event) => {
                      scrollToSamePageHash(event, item.href);
                      setMobileOpen(false);
                    }}
                  >
                    {item.label}
                    {item.badge ? <NavBadge text={item.badge} /> : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}

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
                  onClick={(event) => scrollToSamePageHash(event, item.href)}
                  data-testid={item.href === "/shop" ? "nav-shop" : undefined}
                  className={
                    active
                    ? "shrink-0 border-b-2 border-primary pb-0.5 text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    : "shrink-0 text-sm font-medium text-on-surface-variant outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
      </div>
    </>
  );
}
