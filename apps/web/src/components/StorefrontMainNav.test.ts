import assert from "node:assert/strict";
import test from "node:test";
import type { CmsNavLink } from "@universal-music-store/platform-data";
import {
  DEFAULT_STOREFRONT_NAV_ITEMS,
  flattenMobileNavItems,
  isStorefrontNavLinkActive,
} from "./StorefrontNavUtils";

test("fallback storefront navigation keeps the mobile menu actionable", () => {
  assert.deepEqual(DEFAULT_STOREFRONT_NAV_ITEMS.map((link) => link.href), [
    "/",
    "/shop",
    "/search",
    "/wishlist",
    "/checkout",
    "/account/profile",
  ]);
});

test("mobile CMS navigation preserves nested categories and featured links", () => {
  const links: CmsNavLink[] = [
    {
      href: "/shop",
      label: "Shop",
      children: [{ href: "/shop?category=guitars", label: "Guitars" }],
      featured: { href: "/sale", label: "Sale" },
    },
  ];

  assert.deepEqual(flattenMobileNavItems(links).map((link) => link.href), [
    "/shop",
    "/shop?category=guitars",
    "/sale",
  ]);
});

test("navigation active state respects path segments", () => {
  assert.equal(isStorefrontNavLinkActive("/shop/guitars", "/shop"), true);
  assert.equal(isStorefrontNavLinkActive("/shopping", "/shop"), false);
  assert.equal(isStorefrontNavLinkActive("/shop", "/shop?category=guitars"), true);
});
