import type { CmsNavLink } from "@universal-music-store/platform-data";

export type FlatStorefrontNavItem = { href: string; label: string; badge?: string };

export const DEFAULT_STOREFRONT_NAV_ITEMS: FlatStorefrontNavItem[] = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/search", label: "Search" },
  { href: "/wishlist", label: "Saved items" },
  { href: "/checkout", label: "Bag" },
  { href: "/account/profile", label: "Account" },
];

export function isStorefrontNavLinkActive(pathname: string, href: string): boolean {
  const url = new URL(href, "https://uvs.local");
  if (url.pathname === "/") return pathname === "/";
  return pathname === url.pathname || pathname.startsWith(`${url.pathname}/`);
}

export function flattenMobileNavItems(
  items: CmsNavLink[],
  seen = new Set<string>(),
): FlatStorefrontNavItem[] {
  return items.flatMap((link) => {
    const key = `${link.href}\u0000${link.label}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const current: FlatStorefrontNavItem = { href: link.href, label: link.label, badge: link.badge };
    const children = link.children ? flattenMobileNavItems(link.children, seen) : [];
    const featured = link.featured
      ? flattenMobileNavItems([{ href: link.featured.href, label: link.featured.label }], seen)
      : [];
    return [current, ...children, ...featured];
  });
}
